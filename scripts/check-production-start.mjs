import { spawn } from "node:child_process";
import { createServer } from "node:net";
import assert from "node:assert/strict";

// Isolated process environment: never inherit real credentials or touch a DB.
const base = {
  NODE_ENV: "production",
  HOST: "127.0.0.1",
  SESSION_SECRET: "synthetic-startup-secret-".repeat(2),
  DATABASE_URL: "postgres://test@database.example.invalid/test",
  PUBLIC_APP_URL: "https://app.example.invalid",
};
async function refused(changes, expected) {
  const child = spawn(process.execPath, [".output/server/index.mjs"], {
    env: { ...base, ...changes },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let text = "";
  child.stdout.on("data", (chunk) => {
    text += chunk;
  });
  child.stderr.on("data", (chunk) => {
    text += chunk;
  });
  const timer = setTimeout(() => child.kill(), 8000);
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  clearTimeout(timer);
  assert.notEqual(code, 0);
  assert.match(text, new RegExp(expected));
  assert.ok(!text.includes(base.SESSION_SECRET));
  assert.ok(!text.includes(base.DATABASE_URL));
  assert.ok(!/Listening on/.test(text), "Unsafe runtime must fail before listening");
}
for (const [changes, name] of [
  [{ ENABLE_LOCAL_ADMIN_LOGIN: "true" }, "ENABLE_LOCAL_ADMIN_LOGIN"],
  [{ MARKETINGPILOT_PREVIEW_TEST_AI: "true" }, "MARKETINGPILOT_PREVIEW_TEST_AI"],
  [{ MARKETINGPILOT_JSON_FIXTURE: "true" }, "MARKETINGPILOT_JSON_FIXTURE"],
  [{ SESSION_SECRET: "too-short" }, "SESSION_SECRET"],
  [{ PUBLIC_APP_URL: "http://localhost:8080" }, "PUBLIC_APP_URL"],
  [{ DATABASE_URL: "" }, "DATABASE_URL"],
  [
    { NODE_ENV: "development", VERCEL_ENV: "production", ENABLE_LOCAL_ADMIN_LOGIN: "true" },
    "ENABLE_LOCAL_ADMIN_LOGIN",
  ],
])
  await refused(changes, name);

const probe = createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const child = spawn(process.execPath, [".output/server/index.mjs"], {
  env: { ...base, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
let stopped = false;
child.once("exit", () => {
  stopped = true;
});
try {
  let response;
  for (let i = 0; i < 60; i++) {
    if (stopped) throw new Error("Az érvényes production konfiguráció nem indult el.");
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/cron/ai-monitor`, {
        signal: AbortSignal.timeout(1000),
      });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  assert.ok(response);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "UNAUTHORIZED" });
  console.log(
    "PASS: 7 unsafe production startups refused before listening; valid startup and HTTP cron protection verified. No database or external provider called.",
  );
} finally {
  child.kill();
}
