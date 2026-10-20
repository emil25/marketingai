// Run after build:node. No external credentials, database writes or real customer data.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import net from "node:net";
import { chromium, expect } from "@playwright/test";

const port = 8090;
const origin = `http://127.0.0.1:${port}`;
await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.on("error", reject);
  probe.listen(port, "127.0.0.1", () => probe.close(resolve));
});
const server = spawn(process.execPath, [".output/server/index.mjs"], {
  stdio: "ignore",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOST: "127.0.0.1",
    PORT: String(port),
    SESSION_SECRET: randomBytes(40).toString("hex"),
    DATABASE_URL: "",
    DIRECT_URL: "",
    DATABASE_URL_UNPOOLED: "",
    MARKETINGPILOT_JSON_FIXTURE: "true", // Must be rejected even if accidentally enabled.
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
    ENABLE_LOCAL_ADMIN_LOGIN: "true",
  },
});
let browser;
const checks = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Production server exited during startup.");
    try {
      const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.status === 503) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for server startup. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  expect(ready).toBe(true);
  checks.push("production health: 503 without PostgreSQL, no JSON fallback");
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Üdv újra" })).toBeVisible();
  checks.push("production login and client hydration");
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
  await expect(page.getByRole("alert")).toContainText("A regisztráció előkészítés alatt áll");
  await expect(page.getByRole("button", { name: "Regisztráció", exact: true })).toBeDisabled();
  checks.push("production signup blocked without operator/mail/bot configuration");
  const response = await page.goto(`${origin}/nonexistent-beta-production`, {
    waitUntil: "domcontentloaded",
  });
  expect(response.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Az oldal nem található" })).toBeVisible();
  checks.push("Hungarian production 404");
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
