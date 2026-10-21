// Run after build:node. No external credentials, database writes or real customer data.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import { chromium, expect } from "@playwright/test";
import path from "node:path";

const port = 8087;
const origin = `http://127.0.0.1:${port}`;
const sessionSecret = randomBytes(40).toString("hex");
const testDataDirectory = path.resolve(
  "outputs",
  `production-smoke-${randomBytes(8).toString("hex")}`,
);
const blockedStart = spawnSync(process.execPath, [".output/server/index.mjs"], {
  encoding: "utf8",
  env: {
    ...process.env,
    NODE_ENV: "production",
    VERCEL: "",
    VERCEL_ENV: "",
    SESSION_SECRET: sessionSecret,
    DATABASE_URL: "",
    DIRECT_URL: "",
    DATABASE_URL_UNPOOLED: "",
    PUBLIC_APP_URL: "https://example.invalid",
    ENABLE_LOCAL_ADMIN_LOGIN: "true",
    MARKETINGPILOT_PREVIEW_TEST_AI: "false",
    MARKETINGPILOT_JSON_FIXTURE: "false",
  },
});
expect(blockedStart.status).not.toBe(0);
expect(blockedStart.stderr).toContain("nem indulhat el éles környezetben");
expect(blockedStart.stderr).not.toContain(sessionSecret);
await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.on("error", reject);
  probe.listen(port, "127.0.0.1", () => probe.close(resolve));
});
const server = spawn(process.execPath, [".output/server/index.mjs"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    // Serve the production build with an isolated, fictional development fixture.
    // Production startup safety is asserted above; test storage is never enabled in production.
    NODE_ENV: "development",
    HOST: "127.0.0.1",
    PORT: String(port),
    PUBLIC_APP_URL: origin,
    SESSION_SECRET: sessionSecret,
    DATABASE_URL: "",
    DIRECT_URL: "",
    DATABASE_URL_UNPOOLED: "",
    MARKETINGPILOT_JSON_FIXTURE: "true",
    MARKETINGPILOT_DATA_DIR: testDataDirectory,
    MARKETINGPILOT_E2E: "1",
    VERCEL: "",
    VERCEL_ENV: "",
    OPENROUTER_API_KEY: "",
    RESEND_API_KEY: "",
    EMAIL_FROM: "",
    TURNSTILE_SITE_KEY: "",
    TURNSTILE_SECRET_KEY: "",
    OPERATOR_NAME: "",
    OPERATOR_EMAIL: "",
    OPERATOR_ADDRESS: "",
    META_APP_SECRET: "",
    BLOB_READ_WRITE_TOKEN: "",
    ENABLE_LOCAL_ADMIN_LOGIN: "false",
    BETA_MODE: "private",
    BETA_INVITE_CODE: "",
  },
});
let serverLogs = "";
server.stdout?.on("data", (chunk) => (serverLogs += chunk));
server.stderr?.on("data", (chunk) => (serverLogs += chunk));
let browser;
const checks = [];
try {
  let ready = false;
  let lastResponse = "no HTTP response";
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Built server exited during startup.");
    try {
      const response = await fetch(`${origin}/login`, { signal: AbortSignal.timeout(1000) });
      lastResponse = `${response.status} ${await response.text()}`;
      if (response.status === 200) {
        ready = true;
        break;
      }
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      lastResponse = `${error instanceof Error ? error.message : String(error)}${cause?.code ? ` (${cause.code})` : ""}`;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready)
    throw new Error(`Isolated smoke server failed HTTP check: ${lastResponse}\n${serverLogs}`);
  checks.push("isolated smoke server uses fictional local storage");
  checks.push("production startup guard rejects test-mode flags without exposing secrets");
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Üdv újra" })).toBeVisible();
  checks.push("built login page and client hydration");
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((l) => l.href));
  for (const href of styles.filter((href) => new URL(href).origin === origin)) {
    expect((await fetch(href)).status).toBe(200);
  }
  expect(styles.some((href) => new URL(href).origin === origin)).toBe(true);
  checks.push("local production CSS assets: 200");
  await page.goto(`${origin}/app/posts`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login$/);
  checks.push("anonymous direct app access redirects to login");
  await page.goto(`${origin}/signup`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("alert")).toContainText(
    "A zárt béta most nem fogad új regisztrációt",
  );
  await expect(page.getByRole("alert").getByRole("link", { name: "Kapcsolat" })).toHaveAttribute(
    "href",
    "/contact",
  );
  await expect(page.getByRole("button", { name: "Regisztráció", exact: true })).toBeDisabled();
  checks.push("closed beta signup explains the block and links to contact");
  const response = await page.goto(`${origin}/nonexistent-beta-production`, {
    waitUntil: "domcontentloaded",
  });
  expect(response.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Az oldal nem található" })).toBeVisible();
  checks.push("Hungarian 404 response");
  await mkdir("outputs", { recursive: true });
  await writeFile(
    "outputs/beta-production-smoke.json",
    JSON.stringify({ status: "PASS", checks }, null, 2),
  );
  console.log(JSON.stringify({ status: "PASS", checks }));
} finally {
  await browser?.close();
  server.kill();
}
