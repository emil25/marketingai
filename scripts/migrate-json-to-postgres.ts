import { readFileSync } from "node:fs";
import path from "node:path";
import type { AppData } from "../src/lib/data-model";
import { closePostgresPool, importPostgresData } from "../src/lib/server/postgres-store.server";

function loadDotEnv() {
  try {
    const raw = readFileSync(path.resolve(process.cwd(), ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
        value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  } catch {
    // Hosting environments inject variables directly.
  }
}

loadDotEnv();

if (!process.env.DATABASE_URL?.trim() && !process.env.DIRECT_URL?.trim()) {
  console.error("DATABASE_URL vagy DIRECT_URL nincs beállítva; migráció nem futott le.");
  process.exit(1);
}

const dataPath = path.resolve(
  process.env.MARKETINGPILOT_DATA_DIR || path.join(process.cwd(), "data"),
  "marketingpilot.json",
);
try {
  const data = JSON.parse(readFileSync(dataPath, "utf8")) as AppData;
  await importPostgresData(data);
  console.log(
    `JSON snapshot imported to PostgreSQL (${Object.values(data).reduce((total, value) => total + (Array.isArray(value) ? value.length : 0), 0)} records).`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : "ismeretlen migrációs hiba";
  console.error(`JSON → PostgreSQL migráció sikertelen: ${message}`);
  process.exitCode = 1;
} finally {
  await closePostgresPool();
}
