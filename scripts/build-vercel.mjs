import { spawn } from "node:child_process";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";

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
  if (process.env.VERCEL) {
    if (!environment.DATABASE_URL?.trim()) throw new Error("Production DATABASE_URL is required.");
    if (!environment.SESSION_SECRET || environment.SESSION_SECRET.length < 32)
      throw new Error("Production SESSION_SECRET is required.");
    if (environment.MEDIA_STORAGE !== "vercel-blob")
      throw new Error("Private media storage is required.");
    // Neon supplies a direct URL without exposing it to the client or build log.
    environment.DIRECT_URL ||= process.env.DATABASE_URL_UNPOOLED;
    await run(path.resolve("scripts/migrate-postgres.mjs"));
    if (environment.MARKETINGPILOT_IMPORT_BLOB_PATH) {
      await run("--import", ["tsx", path.resolve("scripts/import-private-snapshot.ts")]);
    }
  }
  await run(path.resolve("node_modules/vite/bin/vite.js"), ["build", "--configLoader", "native"]);
  // Weekly AI requests run sequentially; retain a bounded five-minute server budget.
  const functionConfigPath = path.resolve(".vercel/output/functions/__server.func/.vc-config.json");
  const functionConfig = JSON.parse(await readFile(functionConfigPath, "utf8"));
  functionConfig.maxDuration = 300;
  await writeFile(functionConfigPath, JSON.stringify(functionConfig, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Vercel build failed.");
  process.exitCode = 1;
}
