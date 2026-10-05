import { get } from "@vercel/blob";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import type { AppData } from "../src/lib/data-model";
import { closePostgresPool, importPostgresData } from "../src/lib/server/postgres-store.server";

// No HTTP endpoint. This runs only in an authorized deployment build. The source
// backup stays in the private store; no passwords, tokens or record contents log.
const pathname = process.env.MARKETINGPILOT_IMPORT_BLOB_PATH;
if (!pathname || !/^migrations\/marketingpilot-[a-f0-9]{64}\.json$/.test(pathname))
  throw new Error("A privát migrációs snapshot útvonala hiányzik vagy érvénytelen.");
const expectedHash = pathname.match(/([a-f0-9]{64})\.json$/)![1];
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const version = `json_snapshot_${expectedHash}`;
try {
  const applied = await pool.query("SELECT 1 FROM _marketingpilot_migrations WHERE version = $1", [version]);
  if (applied.rowCount) {
    console.log("Private JSON import already completed; existing records left unchanged.");
  } else {
    const result = await get(pathname, { access: "private", abortSignal: AbortSignal.timeout(60_000) });
    if (!result || result.statusCode !== 200 || result.blob.size > 20 * 1024 * 1024)
      throw new Error("A privát migrációs snapshot nem olvasható.");
    const bytes = Buffer.from(await new Response(result.stream).arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== expectedHash)
      throw new Error("A migrációs snapshot ellenőrzőösszege eltér. Import nem történt.");
    const data = JSON.parse(bytes.toString("utf8")) as AppData;
    // Existing adapter refuses a nonempty target and validates all relationships
    // in a transaction. This must never use allowExisting or merge by guessing.
    await importPostgresData(data);
    await pool.query("INSERT INTO _marketingpilot_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING", [version]);
    console.log("Private JSON snapshot imported successfully; original local file preserved.");
  }
} catch {
  console.error("Private JSON import failed. Existing data was not replaced; inspect source integrity and deployment configuration.");
  process.exitCode = 1;
} finally {
  await closePostgresPool();
  await pool.end();
}
