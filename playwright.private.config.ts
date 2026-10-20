import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
import path from "node:path";
if (process.env.BASE_URL)
  throw new Error("Ez a meghívókódos teszt csak elkülönített helyi adatokkal fut.");
process.env.PRIVATE_BETA_E2E = "1";
export default defineConfig({
  ...base,
  outputDir: "outputs/private-beta-results",
  reporter: [["list"], ["html", { outputFolder: "outputs/private-beta-report", open: "never" }]],
  testMatch: "**/private-beta.spec.ts",
  testIgnore: [],
  use: { ...base.use, baseURL: "http://127.0.0.1:8088", trace: "off" },
  webServer: {
    ...(base.webServer as object),
    command:
      "node --import ./tests/e2e/provider-mock.mjs node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8088 --strictPort",
    url: "http://127.0.0.1:8088/api/health",
    reuseExistingServer: false,
    timeout: 240000,
    env: {
      ...(base.webServer as { env: Record<string, string> }).env,
      BETA_MODE: "private",
      BETA_INVITE_CODE: "synthetic-private-beta-invitation",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      PUBLIC_APP_URL: "http://127.0.0.1:8088",
      MARKETINGPILOT_DATA_DIR: path.resolve("outputs/private-beta-e2e-data"),
      WEEKLY_REMINDERS_ENABLED: "false",
    },
  },
});
