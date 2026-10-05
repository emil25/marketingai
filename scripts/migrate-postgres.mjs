import { readdir, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  try {
    const raw = readFileSync(path.join(projectRoot, ".env"), "utf8");
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
    // Environment variables may be injected by the hosting platform.
  }
}

loadDotEnv();

const connectionString = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("DATABASE_URL vagy DIRECT_URL nincs beállítva; migráció nem futott le.");
  process.exit(1);
}

const sslRequired =
  process.env.DATABASE_SSL === "require" || /(?:[?&]sslmode=require\b)/i.test(connectionString);
const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  ...(sslRequired ? { ssl: { rejectUnauthorized: false } } : {}),
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _marketingpilot_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const migrationDirectory = path.join(projectRoot, "db", "migrations");
  const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const applied = await pool.query(
      "SELECT 1 FROM _marketingpilot_migrations WHERE version = $1",
      [version],
    );
    if (applied.rowCount) continue;
    const sql = await readFile(path.join(migrationDirectory, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO _marketingpilot_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
      console.log(`Applied PostgreSQL migration: ${version}`);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  console.log("PostgreSQL schema is ready.");
} catch (error) {
  const message = error instanceof Error ? error.message : "ismeretlen adatbázishiba";
  console.error(`PostgreSQL migration failed: ${message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
