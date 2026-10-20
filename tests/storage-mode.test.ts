import { test } from "node:test";
import assert from "node:assert/strict";
import { assertJsonFixtureAllowed } from "../src/lib/server/storage-mode.server";
test("JSON requires explicit fixture opt-in and can never replace production PostgreSQL", () => {
  const keys = ["NODE_ENV", "VERCEL", "MARKETINGPILOT_JSON_FIXTURE"];
  const before = keys.map((key) => process.env[key]);
  try {
    keys.forEach((key) => delete process.env[key]);
    assert.throws(assertJsonFixtureAllowed, /adatbázis/);
    process.env.MARKETINGPILOT_JSON_FIXTURE = "true";
    assert.doesNotThrow(assertJsonFixtureAllowed);
    process.env.NODE_ENV = "production";
    assert.throws(assertJsonFixtureAllowed, /adatbázis/);
    process.env.NODE_ENV = "development";
    process.env.VERCEL = "1";
    assert.throws(assertJsonFixtureAllowed, /adatbázis/);
  } finally {
    keys.forEach((key, i) => {
      if (before[i] === undefined) delete process.env[key];
      else process.env[key] = before[i];
    });
  }
});
