import assert from "node:assert/strict";
import test from "node:test";
import { safeDatabaseErrorMetadata } from "../src/lib/server/safe-db-error.server";

test("safe database diagnostics retain SQL state and safe schema identifiers only", () => {
  const result = safeDatabaseErrorMetadata({
    code: "23503",
    table: "ai_jobs",
    column: "brand_id",
    constraint: "ai_jobs_brand_id_fkey",
    message: "private SQL statement containing a prompt",
    detail: "private row data",
  });

  assert.deepEqual(result, {
    sqlState: "23503",
    table: "ai_jobs",
    column: "brand_id",
    constraint: "ai_jobs_brand_id_fkey",
  });
  assert.ok(!JSON.stringify(result).includes("private"));
});

test("untrusted or non-PostgreSQL diagnostic fields are omitted", () => {
  assert.equal(safeDatabaseErrorMetadata({ code: "ECONNRESET", table: "users" }), undefined);
  assert.deepEqual(safeDatabaseErrorMetadata({ code: "23505", table: "users WHERE true" }), {
    sqlState: "23505",
  });
  assert.equal(safeDatabaseErrorMetadata(new Error("database secret")), undefined);
});

