import test from "node:test";
import assert from "node:assert/strict";
import {
  cronAuthorized,
  handleOperationsMonitor,
  monitorConfiguration,
  operatorEmailText,
  readRemainingCredits,
  type MonitorReport,
  type MonitorRepository,
} from "../src/lib/server/operations-monitor.server";

const env = {
  CRON_SECRET: "private-test-only-".repeat(3),
  DATABASE_URL: "test-present",
  OPENROUTER_API_KEY: "test-ai-key",
  RESEND_API_KEY: "test-email-key",
  EMAIL_FROM: "test@example.invalid",
  OPERATOR_EMAIL: "operator@example.invalid",
};
const request = () =>
  new Request("https://app.example.com/api/cron/ai-monitor", {
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
const now = () => new Date("2026-10-08T06:30:00.000Z");
function repository() {
  let report: MonitorReport | null = null;
  let complete = false;
  let claimed = false;
  const ranges: string[][] = [];
  const repo: MonitorRepository = {
    async claim() {
      if (claimed || complete) return null;
      claimed = true;
      return { report };
    },
    async counts(start, end) {
      ranges.push([start, end]);
      return { HTTP_402: 1, HTTP_429: 10, TIMEOUT: 5 };
    },
    async save(_day, _lease, next) {
      report = structuredClone(next);
    },
    async complete() {
      complete = true;
    },
    async release() {
      claimed = false;
    },
  };
  return { repo, ranges, report: () => report };
}
test("cron requires a long server-only bearer secret, not cookies, URL parameters or user-agent", async () => {
  assert.equal(cronAuthorized(request(), env), true);
  for (const bad of [
    new Request("https://app.example.com/?secret=" + env.CRON_SECRET),
    new Request(request().url, {
      headers: { "user-agent": "vercel-cron/1.0", Cookie: "session=present" },
    }),
    new Request(request().url, { headers: { Authorization: "Bearer wrong" } }),
  ]) {
    let touched = false;
    const response = await handleOperationsMonitor(bad, {
      env,
      repository: async () => {
        touched = true;
        throw new Error();
      },
    });
    assert.equal(response.status, 401);
    assert.equal(touched, false);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
  assert.equal(cronAuthorized(request(), { ...env, CRON_SECRET: "tiny" }), false);
});
test("credit monitoring uses the minimum of finite key budget and account balance; restricted account access falls back safely", async () => {
  const paths: string[] = [];
  const result = await readRemainingCredits(env, (async (url, init) => {
    paths.push(String(url));
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    return Response.json({
      data: String(url).endsWith("key")
        ? { limit_remaining: 2 }
        : { total_credits: 100, total_usage: 90 },
    });
  }) as typeof fetch);
  assert.equal(result, 2);
  assert.equal(paths.length, 2);
  assert.equal(
    await readRemainingCredits(env, (async (url) =>
      String(url).endsWith("key")
        ? Response.json({ data: { limit_remaining: 3 } })
        : new Response("sensitive provider body", { status: 403 })) as typeof fetch),
    3,
  );
  assert.equal(
    await readRemainingCredits(env, (async () => {
      throw new Error("sensitive upstream details");
    }) as typeof fetch),
    null,
  );
});
test("last 24h errors and low credits produce only category, count and timestamp; a repeated daily run sends nothing", async () => {
  const store = repository();
  const sent: Array<{ body: Record<string, unknown>; key: string | null }> = [];
  const fetcher = (async (url, init) => {
    if (String(url).includes("resend")) {
      sent.push({
        body: JSON.parse(init!.body as string),
        key: new Headers(init?.headers).get("Idempotency-Key"),
      });
      return Response.json({ id: "test" });
    }
    return Response.json({
      data: String(url).endsWith("key")
        ? { limit_remaining: 1, label: "sensitive" }
        : { total_credits: 3, total_usage: 2 },
    });
  }) as typeof fetch;
  const deps = { env, now, repository: async () => store.repo, fetcher };
  assert.equal((await handleOperationsMonitor(request(), deps)).status, 200);
  assert.deepEqual(store.ranges, [["2026-10-07T06:30:00.000Z", "2026-10-08T06:30:00.000Z"]]);
  assert.deepEqual(
    store.report()!.alerts.map((a) => a.category),
    ["HTTP_402", "HTTP_429", "TIMEOUT", "LOW_CREDITS"],
  );
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body.to, [env.OPERATOR_EMAIL]);
  assert.equal(sent[0].key, "marketingpilot-operations/2026-10-08");
  assert.ok(!JSON.stringify(sent[0].body).includes(env.OPENROUTER_API_KEY));
  assert.ok(!JSON.stringify(sent[0].body).includes("sensitive"));
  assert.ok(!JSON.stringify(store.report()).includes("label"));
  assert.equal((await handleOperationsMonitor(request(), deps)).status, 200);
  assert.equal(sent.length, 1);
});
test("email failure returns 503 and retry uses the exact persisted payload and idempotency key without rechecking providers", async () => {
  const store = repository();
  const bodies: string[] = [];
  let failures = 1;
  let creditChecks = 0;
  const fetcher = (async (url, init) => {
    if (String(url).includes("resend")) {
      bodies.push(init!.body as string);
      return new Response("private provider failure", { status: failures-- > 0 ? 500 : 200 });
    }
    creditChecks++;
    return Response.json({ data: { limit_remaining: 1 } });
  }) as typeof fetch;
  const deps = { env, now, repository: async () => store.repo, fetcher };
  assert.equal((await handleOperationsMonitor(request(), deps)).status, 503);
  assert.equal(
    (
      await handleOperationsMonitor(request(), {
        ...deps,
        now: () => new Date("2026-10-08T07:30:00Z"),
      })
    ).status,
    200,
  );
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(creditChecks, 2);
});
test("healthy thresholds send no email; unavailable audit or credit monitor is never silently reported as healthy", async () => {
  const store = repository();
  let emails = 0;
  const fetcher = (async (url) => {
    if (String(url).includes("resend")) emails++;
    return Response.json({ data: { limit_remaining: 50 } });
  }) as typeof fetch;
  const high = {
    ...env,
    AI_MONITOR_402_THRESHOLD: "2",
    AI_MONITOR_429_THRESHOLD: "11",
    AI_MONITOR_TIMEOUT_THRESHOLD: "6",
  };
  await handleOperationsMonitor(request(), {
    env: high,
    now,
    repository: async () => store.repo,
    fetcher,
  });
  assert.equal(emails, 0);
  const unavailable = repository();
  unavailable.repo.counts = async () => {
    throw new Error("database details");
  };
  await handleOperationsMonitor(request(), {
    env,
    now,
    repository: async () => unavailable.repo,
    fetcher: (async (url) =>
      String(url).includes("resend")
        ? new Response(null, { status: 200 })
        : new Response(null, { status: 403 })) as typeof fetch,
  });
  assert.deepEqual(
    unavailable.report()!.alerts.map((a) => a.category),
    ["AUDIT_CHECK_UNAVAILABLE", "CREDIT_CHECK_UNAVAILABLE"],
  );
});
test("invalid thresholds, missing configuration and injected report fields fail closed without secret output", async () => {
  for (const changes of [
    { AI_MONITOR_402_THRESHOLD: "0" },
    { AI_MONITOR_CREDITS_THRESHOLD_USD: "bad" },
    { OPERATOR_EMAIL: "bad" },
    { RESEND_API_KEY: "" },
  ])
    assert.throws(() => monitorConfiguration({ ...env, ...changes }), /MONITOR_CONFIGURATION/);
  assert.throws(() =>
    operatorEmailText({
      checkedAt: now().toISOString(),
      alerts: [{ category: "PROMPT_BODY", count: 1 }],
    } as unknown as MonitorReport),
  );
  let touched = false;
  const response = await handleOperationsMonitor(request(), {
    env: { ...env, DATABASE_URL: "" },
    repository: async () => {
      touched = true;
      throw new Error();
    },
  });
  assert.equal(response.status, 503);
  assert.equal(touched, false);
  assert.ok(!(await response.text()).includes(env.CRON_SECRET));
});
test("overlapping cron invocations acquire a single daily lease", async () => {
  const store = repository();
  let mails = 0;
  const originalRelease = store.repo.release;
  // Match the DB rule: a caller without this lease cannot release another run.
  let owner = "";
  const claim = store.repo.claim;
  store.repo.claim = async (day, token) => {
    const result = await claim(day, token);
    if (result) owner = token;
    return result;
  };
  store.repo.release = async (day, token) => {
    if (token === owner) await originalRelease(day, token);
  };
  const fetcher = (async (url) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (String(url).includes("resend")) {
      mails++;
      return Response.json({ id: "test" });
    }
    return Response.json({ data: { limit_remaining: 1 } });
  }) as typeof fetch;
  const deps = { env, now, repository: async () => store.repo, fetcher };
  const responses = await Promise.all([
    handleOperationsMonitor(request(), deps),
    handleOperationsMonitor(request(), deps),
  ]);
  assert.ok(responses.every((response) => response.status === 200));
  assert.equal(mails, 1);
});
