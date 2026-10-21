import assert from "node:assert/strict";
import test from "node:test";
import { nullableJsonbParameter } from "../src/lib/server/postgres-json.server";

test("nullable JSONB fields stay SQL NULL when they have no value", () => {
  assert.equal(nullableJsonbParameter(null), null);
  assert.equal(nullableJsonbParameter(undefined), null);
});

test("nullable JSONB fields serialize provided values as JSON", () => {
  assert.equal(nullableJsonbParameter({ ideas: ["Mai kínálat"] }), '{"ideas":["Mai kínálat"]}');
});

