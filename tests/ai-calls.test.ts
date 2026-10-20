import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createTestDataDir, removeTestDataDir } from "./test-data-dir";
import { aiDailyLimit, aiProviderMessage, aiUsage } from "../src/lib/ai-call-policy";
import {
  reserveAiCall,
  finishAiCall,
  annotateAiResponse,
  associateAiResponse,
  rejectAiResponse,
  summarizeAiReasonCounts,
} from "../src/lib/server/ai-calls.server";
import type { WorkspaceSnapshot } from "../src/lib/data-model";

test("limits fail closed and only actual nonnegative provider usage is accepted", () => {
  assert.equal(aiDailyLimit(undefined), 100);
  for (const value of ["0", "-1", "NaN", "1.5", "10001"]) assert.throws(() => aiDailyLimit(value));
  assert.deepEqual(aiUsage({ prompt_tokens: 123, completion_tokens: 45, cost: 0.003 }), {
    inputTokens: 123,
    outputTokens: 45,
    cost: 0.003,
  });
  assert.deepEqual(aiUsage({ prompt_tokens: -1, completion_tokens: "12", cost: Infinity }), {
    inputTokens: null,
    outputTokens: null,
    cost: null,
  });
  assert.equal(
    aiProviderMessage(402),
    "A generálás átmenetileg nem érhető el. Ez nem a te hibád, próbáld újra később.",
  );
  assert.match(aiProviderMessage(429), /kérés/);
  assert.match(aiProviderMessage(503), /átmenetileg/);
});

test("parallel daily reservations enforce the user cap across workspaces; validation failures retain usage", async () => {
  const dir = await createTestDataDir("ai-audit");
  const envKeys = [
    "DATABASE_URL",
    "DIRECT_URL",
    "VERCEL",
    "MARKETINGPILOT_DATA_DIR",
    "AI_DAILY_CALL_LIMIT",
  ];
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  delete process.env.VERCEL;
  process.env.MARKETINGPILOT_DATA_DIR = dir;
  process.env.AI_DAILY_CALL_LIMIT = "2";
  const context = (userId = "user-test", workspaceId = "ws-test") =>
    ({
      user: { id: userId },
      workspace: { id: workspaceId },
      membership: { userId, workspaceId },
      activeBrand: { id: `brand-${workspaceId}`, workspaceId },
    }) as WorkspaceSnapshot;
  try {
    const reservations = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        reserveAiCall(
          context("user-test", `workspace-${i}`),
          "weekly_campaign_plan",
          "server-model",
        ),
      ),
    );
    assert.equal(reservations.filter((r) => r.status === "fulfilled").length, 2);
    assert.equal(reservations.filter((r) => r.status === "rejected").length, 3);
    const id = (
      reservations.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<string>
    ).value;
    await finishAiCall(id, {
      status: "success",
      httpStatus: 200,
      latencyMs: 300,
      usage: { prompt_tokens: 123, completion_tokens: 45, cost: 0.003 },
    });
    const response = Response.json({ choices: [] });
    associateAiResponse(response, id);
    await rejectAiResponse(response, "HARD_CLAIM_PRICE");
    const calls = JSON.parse(await readFile(path.join(dir, "ai-calls.json"), "utf8"));
    const call = calls.find((c: { id: string }) => c.id === id);
    assert.equal(call.status, "error");
    assert.equal(call.errorCode, "HARD_CLAIM_PRICE");
    assert.equal(call.inputTokens, 123);
    assert.equal(call.outputTokens, 45);
    assert.equal(call.cost, 0.003);
    assert.equal(call.latencyMs, 300);
    assert.ok(call.createdAt.endsWith("Z") && call.completedAt.endsWith("Z"));
    const originalError = console.error;
    const alerts: unknown[][] = [];
    try {
      console.error = (...args: unknown[]) => {
        alerts.push(args);
      };
      await finishAiCall(id, { status: "error", httpStatus: 402, errorCode: "HTTP_402" });
    } finally {
      console.error = originalError;
    }
    assert.equal(alerts.length, 1);
    assert.deepEqual(JSON.parse(String(alerts[0][0])), {
      event: "AI_PROVIDER_CREDITS_EXHAUSTED", provider: "openrouter", callId: id, status: 402, code: "HTTP_402",
    });
    assert.doesNotMatch(JSON.stringify(calls), /prompt|completion|api_key|authorization|secret/i);
    const softId = await reserveAiCall(context("soft-user", "ws-test"), "factual_post_variants", "server-model");
    await finishAiCall(softId, { status: "success", httpStatus: 200 });
    const accepted = Response.json({ choices: [] });
    associateAiResponse(accepted, softId);
    await annotateAiResponse(accepted, "SOFT_CLAIM_ADJECTIVE");
    const updatedCalls = JSON.parse(await readFile(path.join(dir, "ai-calls.json"), "utf8"));
    assert.equal(updatedCalls.find((item: { id: string }) => item.id === softId).errorCode, "SOFT_CLAIM_ADJECTIVE");
    await reserveAiCall(context("other-user"), "test", "server-model");
    await assert.rejects(
      reserveAiCall(
        {
          ...context(),
          activeBrand: { id: "foreign", workspaceId: "foreign" },
        } as WorkspaceSnapshot,
        "test",
        "model",
      ),
      /saját márka/,
    );
  } finally {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    await removeTestDataDir(dir);
  }
});

test("daily reason shares expose only workspace-scoped category counts", () => {
  const summary = summarizeAiReasonCounts(
    [
      { workspaceId: "ws-a", createdAt: "2026-10-11T01:00:00.000Z", errorCode: "HARD_CLAIM_PRICE" },
      { workspaceId: "ws-a", createdAt: "2026-10-11T12:00:00.000Z", errorCode: "SOFT_CLAIM_ADJECTIVE" },
      { workspaceId: "ws-a", createdAt: "2026-10-10T23:59:59.000Z", errorCode: "SCHEMA_INVALID_JSON" },
      { workspaceId: "ws-b", createdAt: "2026-10-11T02:00:00.000Z", errorCode: "HTTP_402" },
      { workspaceId: "ws-a", createdAt: "2026-10-11T03:00:00.000Z", errorCode: "hello@example.com" },
    ],
    "ws-a",
    new Date("2026-10-11T18:00:00.000Z"),
  );
  assert.equal(summary.date, "2026-10-11");
  assert.equal(summary.total, 2);
  assert.deepEqual(summary.reasons, [
    { category: "HARD_CLAIM_PRICE", count: 1, sharePercent: 50 },
    { category: "SOFT_CLAIM_ADJECTIVE", count: 1, sharePercent: 50 },
  ]);
  assert.doesNotMatch(JSON.stringify(summary), /example|prompt|response|text/i);
});
