import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { replaceAtomicFile } from "./atomic-file.server";
import path from "node:path";
import { aiDailyLimit, aiUsage } from "../ai-call-policy";
import type { WorkspaceSnapshot } from "../data-model";

type Call = {
  id: string;
  userId: string;
  workspaceId: string;
  brandId: string;
  endpoint: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: number | null;
  latencyMs: number | null;
  status: "pending" | "success" | "error";
  httpStatus: number | null;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
};
const AI_REASON_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const pgEnabled = () => !!(process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim());
const file = () =>
  path.join(
    process.env.MARKETINGPILOT_DATA_DIR || path.join(process.cwd(), "data"),
    "ai-calls.json",
  );
let queue: Promise<unknown> = Promise.resolve();
function reasonSummary(date: Date, groups: Map<string, number>) {
  const total = [...groups.values()].reduce((sum, count) => sum + count, 0);
  return {
    date: date.toISOString().slice(0, 10),
    total,
    reasons: [...groups.entries()].map(([category, count]) => ({
      category,
      count,
      sharePercent: total ? Math.round((count / total) * 100) : 0,
    })),
  };
}

export function summarizeAiReasonCounts(
  calls: Array<{ workspaceId: string; createdAt: string; errorCode: string | null }>,
  workspaceId: string,
  date = new Date(),
) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);
  const groups = new Map<string, number>();
  for (const call of calls) {
    if (
      call.workspaceId !== workspaceId ||
      call.createdAt < start.toISOString() ||
      call.createdAt >= end.toISOString() ||
      !call.errorCode ||
      !AI_REASON_CODE.test(call.errorCode)
    )
      continue;
    groups.set(call.errorCode, (groups.get(call.errorCode) ?? 0) + 1);
  }
  return reasonSummary(start, groups);
}
async function local<T>(fn: (calls: Call[]) => T) {
  const run = queue.then(async () => {
    let calls: Call[];
    try {
      calls = JSON.parse(await readFile(file(), "utf8"));
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT"))
        throw error;
      calls = [];
    }
    const result = fn(calls);
    await mkdir(path.dirname(file()), { recursive: true });
    const temp = `${file()}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(calls));
    await replaceAtomicFile(temp, file());
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}
async function readLocal<T>(fn: (calls: Call[]) => T) {
  const run = queue.then(async () => {
    let calls: Call[];
    try {
      calls = JSON.parse(await readFile(file(), "utf8"));
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT"))
        throw error;
      calls = [];
    }
    return fn(calls);
  });
  queue = run.catch(() => undefined);
  return run;
}
export async function reserveAiCall(context: WorkspaceSnapshot, endpoint: string, model: string) {
  if (context.user.emailVerified === false && context.user.canUseAi !== true) throw new Error("Az AI használatához előbb erősítsd meg az e-mail-címed. A fiókmenüben újraküldheted a levelet.");
  if (
    !context.activeBrand ||
    context.activeBrand.workspaceId !== context.workspace.id ||
    context.membership.userId !== context.user.id ||
    context.membership.workspaceId !== context.workspace.id
  )
    throw new Error("Bejelentkezés és saját márka szükséges a generáláshoz.");
  const limit = aiDailyLimit(process.env.AI_DAILY_CALL_LIMIT);
  const now = new Date();
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);
  const retentionStart = new Date(now.getTime() - 90 * 86400000).toISOString();
  const call: Call = {
    id: `aicall_${randomUUID()}`,
    userId: context.user.id,
    workspaceId: context.workspace.id,
    brandId: context.activeBrand.id,
    endpoint,
    model,
    inputTokens: null,
    outputTokens: null,
    cost: null,
    latencyMs: null,
    status: "pending",
    httpStatus: null,
    errorCode: null,
    createdAt: now.toISOString(),
    completedAt: null,
  };
  const exceeded = () =>
    new Error(
      "Elérted a mai AI-hívási korlátot. Holnap újra generálhatsz; a mentett tartalmaid elérhetők maradnak.",
    );
  if (!pgEnabled()) {
    if (process.env.VERCEL) throw new Error("Az AI naplózásához tartós adatbázis szükséges.");
    await local((calls) => {
      for (let i = calls.length - 1; i >= 0; i--) if (calls[i].createdAt < retentionStart) calls.splice(i, 1);
      if (
        calls.filter(
          (c) =>
            c.userId === call.userId &&
            c.createdAt >= start.toISOString() &&
            c.createdAt < end.toISOString(),
        ).length >= limit
      )
        throw exceeded();
      calls.push(call);
    });
  } else {
    const { getPool } = await import("./postgres-store.server");
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM ai_calls WHERE created_at < $1", [retentionStart]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `marketingpilot:ai:${call.userId}`,
      ]);
      const count = await client.query(
        "SELECT count(*)::integer AS count FROM ai_calls WHERE user_id=$1 AND created_at >= $2 AND created_at < $3",
        [call.userId, start.toISOString(), end.toISOString()],
      );
      if (count.rows[0].count >= limit) throw exceeded();
      await client.query(
        "INSERT INTO ai_calls(id,user_id,workspace_id,brand_id,endpoint,model,status,created_at) VALUES($1,$2,$3,$4,$5,$6,'pending',$7)",
        [call.id, call.userId, call.workspaceId, call.brandId, endpoint, model, call.createdAt],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  return call.id;
}

export async function deleteUserAiAudit(userId: string) {
  if (pgEnabled()) {
    const { getPool } = await import("./postgres-store.server");
    await getPool().query("DELETE FROM ai_calls WHERE user_id=$1", [userId]);
  } else {
    await local((calls) => { for (let i = calls.length - 1; i >= 0; i--) if (calls[i].userId === userId) calls.splice(i, 1); });
  }
}
export async function finishAiCall(
  id: string,
  result: {
    status: "success" | "error";
    provider?: "openrouter" | "gemini" | "groq";
    latencyMs?: number;
    httpStatus?: number;
    errorCode?: string;
    usage?: unknown;
    model?: string;
  },
) {
  const usage = aiUsage(result.usage);
  const completedAt = new Date().toISOString();
  if (!pgEnabled()) {
    await local((calls) => {
      const call = calls.find((c) => c.id === id);
      if (call)
        Object.assign(call, {
          inputTokens: usage.inputTokens ?? call.inputTokens,
          outputTokens: usage.outputTokens ?? call.outputTokens,
          cost: usage.cost ?? call.cost,
          status: result.status,
          latencyMs: result.latencyMs ?? call.latencyMs,
          httpStatus: result.httpStatus ?? call.httpStatus,
          errorCode: result.errorCode ?? null,
          model: result.model ?? call.model,
          completedAt,
        });
    });
  } else {
    const { getPool } = await import("./postgres-store.server");
    await getPool().query(
      "UPDATE ai_calls SET status=$2, latency_ms=coalesce($3,latency_ms), http_status=coalesce($4,http_status), error_code=$5, input_tokens=coalesce($6,input_tokens), output_tokens=coalesce($7,output_tokens), cost=coalesce($8,cost), completed_at=$9, model=coalesce($10,model) WHERE id=$1",
      [
        id,
        result.status,
        result.latencyMs ?? null,
        result.httpStatus ?? null,
        result.errorCode ?? null,
        usage.inputTokens,
        usage.outputTokens,
        usage.cost,
        completedAt,
        result.model ?? null,
      ],
    );
  }
  if (result.status === "error")
    console.error(JSON.stringify({
      event: result.httpStatus === 402 ? "AI_PROVIDER_CREDITS_EXHAUSTED" : "AI_CALL_FAILED",
      provider: result.provider ?? "openrouter",
      callId: id,
      status: result.httpStatus ?? null,
      code: result.errorCode ?? "UNKNOWN",
    }));
}
const responseCalls = new WeakMap<Response, string>();
export function associateAiResponse(response: Response, id: string) {
  responseCalls.set(response, id);
}
export async function rejectAiResponse(response: Response, errorCode = "SCHEMA_INVALID_VALUE") {
  const id = responseCalls.get(response);
  if (id)
    await finishAiCall(id, {
      status: "error",
      errorCode: AI_REASON_CODE.test(errorCode) ? errorCode : "SCHEMA_INVALID_VALUE",
    });
}

/** Store accepted soft-claim review categories without retaining content. */
export async function annotateAiResponse(response: Response, errorCode: string) {
  const id = responseCalls.get(response);
  if (!id || !AI_REASON_CODE.test(errorCode)) return;
  if (!pgEnabled()) {
    await local((calls) => {
      const call = calls.find((item) => item.id === id);
      if (call && call.status === "success") call.errorCode = errorCode;
    });
    return;
  }
  const { getPool } = await import("./postgres-store.server");
  await getPool().query(
    "UPDATE ai_calls SET error_code=$2 WHERE id=$1 AND status='success'",
    [id, errorCode],
  );
}

export async function aiValidationReasonSummary(workspaceId: string, date = new Date()) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);
  const groups = new Map<string, number>();
  if (!pgEnabled()) {
    return readLocal((calls) => summarizeAiReasonCounts(calls, workspaceId, start));
  } else {
    const { getPool } = await import("./postgres-store.server");
    const result = await getPool().query<{ error_code: string; count: number }>(
      "SELECT error_code, count(*)::integer AS count FROM ai_calls WHERE workspace_id=$1 AND created_at >= $2 AND created_at < $3 AND error_code IS NOT NULL GROUP BY error_code ORDER BY count(*) DESC, error_code ASC",
      [workspaceId, start.toISOString(), end.toISOString()],
    );
    for (const row of result.rows)
      if (AI_REASON_CODE.test(row.error_code)) groups.set(row.error_code, Number(row.count));
  }
  return reasonSummary(start, groups);
}

