import { spawn } from "node:child_process";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { allowBuildMigration } from "./build-migration-policy.mjs";
import { withProjectCrons } from "./vercel-cron-output.mjs";

const environment = { ...process.env, NITRO_PRESET: "vercel" };

function run(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: environment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Build step failed (${code ?? "signal"}).`));
    });
  });
}

try {
  const migratePreview = allowBuildMigration(environment);
  if (process.env.VERCEL) {
    if (!environment.DATABASE_URL?.trim()) throw new Error("Production DATABASE_URL is required.");
    if (!environment.SESSION_SECRET || environment.SESSION_SECRET.length < 32)
      throw new Error("Production SESSION_SECRET is required.");
    if (environment.MEDIA_STORAGE !== "vercel-blob")
      throw new Error("Private media storage is required.");
    // Neon supplies a direct URL without exposing it to the client or build log.
    environment.DIRECT_URL ||= process.env.DATABASE_URL_UNPOOLED;
    // Database changes require a separate, explicit release step.
    if (environment.MARKETINGPILOT_IMPORT_BLOB_PATH) {
      throw new Error("Data import is not allowed during deployment builds.");
    }
    // Production schema changes and JSON imports are always explicit release steps.
    if (migratePreview) await run(path.resolve("scripts/migrate-postgres.mjs"));
  }
  await run(path.resolve("node_modules/vite/bin/vite.js"), ["build", "--configLoader", "native"]);
  // Weekly AI requests run sequentially; retain a bounded five-minute server budget.
  const functionConfigPath = path.resolve(".vercel/output/functions/__server.func/.vc-config.json");
  const functionConfig = JSON.parse(await readFile(functionConfigPath, "utf8"));
  functionConfig.maxDuration = 300;
  await writeFile(functionConfigPath, JSON.stringify(functionConfig, null, 2));
  const buildConfigPath = path.resolve(".vercel/output/config.json");
  const buildConfig = JSON.parse(await readFile(buildConfigPath, "utf8"));
  const projectConfig = JSON.parse(await readFile(path.resolve("vercel.json"), "utf8"));
  await writeFile(buildConfigPath, JSON.stringify(withProjectCrons(buildConfig, projectConfig), null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Vercel build failed.");
  process.exitCode = 1;
}
