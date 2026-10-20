import { defineConfig } from "@playwright/test";
import path from "node:path";
const external = !!process.env.BASE_URL;
const baseURL = process.env.BASE_URL || "http://127.0.0.1:8087";
if (external) {
  const url = new URL(baseURL);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("BASE_URL csak titkok nélküli HTTPS előnézeti origin lehet.");
  if (process.env.E2E_PREVIEW_ACK !== "isolated-preview")
    throw new Error(
      "Távoli teszt csak elkülönített próbaadatbázison futhat: E2E_PREVIEW_ACK szükséges.",
    );
}
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120000,
  workers: 1,
  fullyParallel: false,
  testIgnore: external ? ["**/beta.spec.ts", "**/ui-modes.spec.ts"] : [],
  reporter: [["list"], ["html", { outputFolder: "outputs/beta-e2e-report", open: "never" }]],
  outputDir: "outputs/beta-e2e-results",
  expect: { timeout: 60000 },
  use: {
    baseURL,
    actionTimeout: 30000,
    navigationTimeout: 60000,
    trace: external ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  webServer: external
    ? undefined
    : {
        command:
          "node --import ./tests/e2e/provider-mock.mjs node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8087 --strictPort",
        url: "http://127.0.0.1:8087/api/health",
        reuseExistingServer: false,
        timeout: 240000,
        env: {
          NODE_ENV: "development",
          BETA_MODE: "off",
          MARKETINGPILOT_E2E: "1",
          MARKETINGPILOT_JSON_FIXTURE: "true",
          MARKETINGPILOT_DATA_DIR: path.resolve("outputs/beta-e2e-data"),
          DATABASE_URL: "",
          DIRECT_URL: "",
          VERCEL: "",
          BLOB_READ_WRITE_TOKEN: "",
          ENABLE_LOCAL_ADMIN_LOGIN: "false",
          SESSION_SECRET: "marketingpilot-isolated-e2e-session-secret-only",
          RESEND_API_KEY: "test-only-not-a-real-key",
          EMAIL_FROM: "MarketingPilot <test@example.invalid>",
          WEEKLY_REMINDERS_ENABLED: "true",
          WEEKLY_REMINDER_TIMEZONE: "Europe/Bucharest",
          PUBLIC_APP_URL: "http://127.0.0.1:8087",
          OPENROUTER_API_KEY: "test-only-not-a-real-key",
          TURNSTILE_SITE_KEY: "",
          TURNSTILE_SECRET_KEY: "",
        },
      },
});
