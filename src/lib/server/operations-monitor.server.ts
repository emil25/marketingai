import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { brandForLocale, DEFAULT_MARKET_LOCALE } from "@/config/brand";

type Environment = Record<string, string | undefined>;
export const alertCategories = [
  "LOW_CREDITS",
  "HTTP_402",
  "HTTP_429",
  "TIMEOUT",
  "CREDIT_CHECK_UNAVAILABLE",
  "AUDIT_CHECK_UNAVAILABLE",
] as const;
const ReportSchema = z
  .object({
    checkedAt: z.string().datetime(),
    alerts: z.array(
      z
        .object({ category: z.enum(alertCategories), count: z.number().int().nonnegative().safe() })
        .strict(),
    ),
  })
  .strict();
export type MonitorReport = z.infer<typeof ReportSchema>;
type Counts = { HTTP_402: number; HTTP_429: number; TIMEOUT: number };
export type MonitorRepository = {
  claim: (day: string, lease: string) => Promise<{ report: unknown } | null>;
  counts: (start: string, end: string) => Promise<Counts>;
  save: (day: string, lease: string, report: MonitorReport) => Promise<void>;
  complete: (day: string, lease: string) => Promise<void>;
  release: (day: string, lease: string) => Promise<void>;
};

export function cronAuthorized(request: Request, env: Environment) {
  const secret = env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization");
  if (!secret || secret.length < 32 || !header) return false;
  // Hash both values so timingSafeEqual never receives unequal lengths.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

function threshold(env: Environment, key: string, fallback: number, integer = false) {
  const value = env[key]?.trim();
  const number = value ? Number(value) : fallback;
  if (
    !Number.isFinite(number) ||
    number < 0 ||
    (integer && (!Number.isSafeInteger(number) || number < 1))
  )
    throw new Error("MONITOR_CONFIGURATION_INVALID");
  return number;
}

export function monitorConfiguration(env: Environment) {
  if (
    !env.DATABASE_URL?.trim() ||
    !env.OPENROUTER_API_KEY?.trim() ||
    !env.RESEND_API_KEY?.trim() ||
    !env.EMAIL_FROM?.trim() ||
    !z.string().email().safeParse(env.OPERATOR_EMAIL?.trim()).success
  )
    throw new Error("MONITOR_CONFIGURATION_INCOMPLETE");
  return {
    credits: threshold(env, "AI_MONITOR_CREDITS_THRESHOLD_USD", 5),
    HTTP_402: threshold(env, "AI_MONITOR_402_THRESHOLD", 1, true),
    HTTP_429: threshold(env, "AI_MONITOR_429_THRESHOLD", 10, true),
    TIMEOUT: threshold(env, "AI_MONITOR_TIMEOUT_THRESHOLD", 5, true),
  };
}

// Never retain or log provider labels, key metadata, response bodies or errors.
export async function readRemainingCredits(env: Environment, fetcher: typeof fetch) {
  const values: number[] = [];
  const get = async (endpoint: string, key: string) => {
    try {
      const response = await fetcher(`https://openrouter.ai/api/v1/${endpoint}`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if (!response.ok) return null;
      return (await response.json()).data as Record<string, unknown>;
    } catch {
      return null;
    }
  };
  const key = await get("key", env.OPENROUTER_API_KEY!);
  if (typeof key?.limit_remaining === "number" && Number.isFinite(key.limit_remaining))
    values.push(key.limit_remaining);
  // /credits may require a management key. A restricted key can still expose its
  // own finite remaining budget through /key; no extra credential is mandatory.
  const account = await get(
    "credits",
    env.OPENROUTER_MANAGEMENT_API_KEY?.trim() || env.OPENROUTER_API_KEY!,
  );
  if (
    typeof account?.total_credits === "number" &&
    Number.isFinite(account.total_credits) &&
    typeof account.total_usage === "number" &&
    Number.isFinite(account.total_usage)
  )
    values.push(account.total_credits - account.total_usage);
  return values.length ? Math.min(...values) : null;
}

export function operatorEmailText(report: MonitorReport) {
  const safe = ReportSchema.parse(report);
  return safe.alerts
    .map(
      (item) => `Kategória: ${item.category}\nDarabszám: ${item.count}\nIdőpont: ${safe.checkedAt}`,
    )
    .join("\n\n");
}

async function sendReport(
  report: MonitorReport,
  day: string,
  env: Environment,
  fetcher: typeof fetch,
) {
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `marketingpilot-operations/${day}`,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [env.OPERATOR_EMAIL!.trim()],
        subject: `${brandForLocale(DEFAULT_MARKET_LOCALE).productName} üzemeltetési riasztás`,
        text: operatorEmailText(report),
      }),
    });
    if (!response.ok) throw new Error();
  } catch {
    throw new Error("ALERT_EMAIL_FAILED");
  }
}

export async function createMonitorRepository(): Promise<MonitorRepository> {
  const { getPool } = await import("./postgres-store.server");
  const pool = getPool();
  const query = (text: string, values: unknown[]) => {
    // node-postgres supports this per-query option; @types/pg only declares it
    // on ClientConfig. Keep the real runtime option without an unsafe cast.
    const config = { text, values, query_timeout: 15000 };
    return pool.query(config);
  };
  const changed = (count: number | null) => {
    if (count !== 1) throw new Error("MONITOR_LEASE_LOST");
  };
  return {
    async claim(day, lease) {
      const result = await query(
        `INSERT INTO operations_monitor_runs(run_date,lease_token,lease_until) VALUES($1,$2,now()+interval '5 minutes')
         ON CONFLICT(run_date) DO UPDATE SET lease_token=$2,lease_until=now()+interval '5 minutes',updated_at=now()
         WHERE operations_monitor_runs.completed_at IS NULL AND operations_monitor_runs.lease_until < now()
         RETURNING report`,
        [day, lease],
      );
      return result.rows[0] ?? null;
    },
    async counts(start, end) {
      const result = await query(
        `SELECT count(*) FILTER (WHERE http_status=402 OR error_code='HTTP_402')::integer AS "HTTP_402",
                count(*) FILTER (WHERE http_status=429 OR error_code='HTTP_429')::integer AS "HTTP_429",
                count(*) FILTER (WHERE error_code='TIMEOUT')::integer AS "TIMEOUT"
         FROM ai_calls WHERE status='error' AND coalesce(completed_at,created_at) >= $1
           AND coalesce(completed_at,created_at) < $2`,
        [start, end],
      );
      return result.rows[0] as Counts;
    },
    async save(day, lease, report) {
      const result = await query(
        `UPDATE operations_monitor_runs SET report=$3::jsonb,updated_at=now()
        WHERE run_date=$1 AND lease_token=$2 AND completed_at IS NULL AND lease_until > now()`,
        [day, lease, JSON.stringify(ReportSchema.parse(report))],
      );
      changed(result.rowCount);
    },
    async complete(day, lease) {
      const result = await query(
        `UPDATE operations_monitor_runs SET completed_at=now(),updated_at=now()
        WHERE run_date=$1 AND lease_token=$2 AND completed_at IS NULL AND lease_until > now()`,
        [day, lease],
      );
      changed(result.rowCount);
    },
    async release(day, lease) {
      await query(
        `UPDATE operations_monitor_runs SET lease_until=now()-interval '1 second',updated_at=now()
        WHERE run_date=$1 AND lease_token=$2 AND completed_at IS NULL`,
        [day, lease],
      );
    },
  };
}

export async function handleOperationsMonitor(
  request: Request,
  dependencies: {
    env?: Environment;
    fetcher?: typeof fetch;
    repository?: () => Promise<MonitorRepository>;
    now?: () => Date;
  } = {},
) {
  const env = dependencies.env ?? process.env;
  const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!cronAuthorized(request, env)) return json({ error: "UNAUTHORIZED" }, 401);
  let repo: MonitorRepository | undefined;
  let day = "";
  const lease = randomUUID();
  try {
    const config = monitorConfiguration(env);
    const now = (dependencies.now ?? (() => new Date()))();
    const checkedAt = now.toISOString();
    day = checkedAt.slice(0, 10);
    repo = await (dependencies.repository ?? createMonitorRepository)();
    const claim = await repo.claim(day, lease);
    if (!claim) return json({ status: "already_running_or_complete" });
    let report: MonitorReport;
    if (claim.report != null) report = ReportSchema.parse(claim.report);
    else {
      report = { checkedAt, alerts: [] };
      try {
        const counts = await repo.counts(
          new Date(now.getTime() - 86400000).toISOString(),
          checkedAt,
        );
        for (const category of ["HTTP_402", "HTTP_429", "TIMEOUT"] as const) {
          if (!Number.isSafeInteger(counts[category]) || counts[category] < 0) throw new Error();
          if (counts[category] >= config[category])
            report.alerts.push({ category, count: counts[category] });
        }
      } catch {
        report.alerts = [{ category: "AUDIT_CHECK_UNAVAILABLE", count: 1 }];
      }
      const credits = await readRemainingCredits(env, dependencies.fetcher ?? fetch);
      if (credits == null) report.alerts.push({ category: "CREDIT_CHECK_UNAVAILABLE", count: 1 });
      else if (credits < config.credits) report.alerts.push({ category: "LOW_CREDITS", count: 1 });
      await repo.save(day, lease, report);
    }
    // Immutable persisted payload plus Resend idempotency handles concurrent cron
    // requests and a crash between sending and recording completion.
    if (report.alerts.length) await sendReport(report, day, env, dependencies.fetcher ?? fetch);
    await repo.complete(day, lease);
    console.info(
      JSON.stringify({
        event: "OPERATIONS_MONITOR_COMPLETE",
        count: report.alerts.length,
        at: report.checkedAt,
      }),
    );
    return json({ status: "checked", alertCategories: report.alerts.length });
  } catch {
    console.error(
      JSON.stringify({ event: "OPERATIONS_MONITOR_FAILED", at: new Date().toISOString() }),
    );
    return json(
      { error: "Az üzemeltetési ellenőrzés nem sikerült. Ellenőrizd a szerver beállításait." },
      503,
    );
  } finally {
    if (repo && day) await repo.release(day, lease).catch(() => undefined);
  }
}
