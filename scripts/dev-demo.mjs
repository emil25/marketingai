import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
if (
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production" ||
  process.env.VERCEL
)
  throw new Error("Demóelőnézet csak helyben indulhat.");
const directory = path.resolve("outputs/demo-data");
const db = JSON.parse(await readFile(path.join(directory, "marketingpilot.json"), "utf8"));
if (db.users.length !== 1 || !db.users[0].email.endsWith("@example.invalid"))
  throw new Error("Csak a külön, kitalált demófiók használható.");
const child = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "8090", "--strictPort"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "development",
      VERCEL: "",
      VERCEL_ENV: "",
      DATABASE_URL: "",
      DIRECT_URL: "",
      BLOB_READ_WRITE_TOKEN: "",
      MEDIA_STORAGE: "local",
      MARKETINGPILOT_JSON_FIXTURE: "true",
      MARKETINGPILOT_DATA_DIR: directory,
      PUBLIC_APP_URL: "http://127.0.0.1:8090",
      SESSION_SECRET: "local-fictional-demo-session-only-2026",
      ENABLE_LOCAL_ADMIN_LOGIN: "true",
      LOCAL_ADMIN_USER_ID: db.users[0].id,
      LOCAL_ADMIN_WORKSPACE_ID: db.workspaces[0].id,
      BETA_MODE: "off",
      WEEKLY_REMINDERS_ENABLED: "false",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      TURNSTILE_SITE_KEY: "",
      TURNSTILE_SECRET_KEY: "",
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
