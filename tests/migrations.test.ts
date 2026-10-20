import assert from "node:assert/strict";
import { test } from "node:test";
import { checkMigrationDirectory, migrationSequenceIssues } from "../scripts/check-migrations";

test("repository migrations are contiguous from 001", async () => {
  assert.deepEqual(await checkMigrationDirectory(), []);
});

test("migration checker reports gaps, duplicate prefixes, and malformed names", () => {
  assert.deepEqual(migrationSequenceIssues(["001_initial.sql", "003_later.sql"]), [
    "Hiányzó migráció: 002",
  ]);
  assert.deepEqual(migrationSequenceIssues(["001_initial.sql", "001_duplicate.sql"]), [
    "Duplikált migrációs sorszám: 001",
  ]);
  assert.deepEqual(migrationSequenceIssues(["bad-name.sql"]), [
    "Nem megfelelő migrációfájlnév: bad-name.sql",
  ]);
});
