import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import type { PoolClient } from "pg";
import type { AppData } from "../src/lib/data-model";
import { replaceDataInClient } from "../src/lib/server/postgres-store.server";

test("audit migration retains daily usage after brand and membership removal", async () => {
  const sql = await readFile(new URL("../db/migrations/005_ai_calls.sql", import.meta.url), "utf8");
  assert.match(sql, /REFERENCES users\(id\) ON DELETE CASCADE/);
  assert.match(sql, /REFERENCES brands\(id\) ON DELETE SET NULL/);
  assert.match(
    sql,
    /REFERENCES memberships\(workspace_id, user_id\) ON DELETE SET NULL \(workspace_id\)/,
  );
  assert.match(sql, /REFERENCES brands\(workspace_id, id\) ON DELETE SET NULL \(brand_id\)/);
});

test("domain saves upsert surviving audit parents and only prune removed identities", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const client = {
    query: async (sql: string, values: unknown[] = []) => {
      queries.push({ sql, values });
      return { rows: [] };
    },
  } as unknown as PoolClient;
  const db = {
    users: [{ id: "u" }],
    workspaces: [{ id: "w" }],
    memberships: [{ id: "m", userId: "u", workspaceId: "w" }],
    brands: [{ id: "b", workspaceId: "w" }],
    brandProfiles: [],
    aiJobs: [],
    posts: [],
    postVariants: [],
    postVersions: [],
    mediaAssets: [],
    analyticsSnapshots: [],
    campaigns: [],
    planItems: [],
    channelConnections: [],
    channelOAuthStates: [],
    channelOAuthSelections: [],
    publishAttempts: [],
  } as unknown as AppData;
  await replaceDataInClient(client, db);
  for (const [table, id] of [
    ["users", "u"],
    ["workspaces", "w"],
    ["memberships", "m"],
    ["brands", "b"],
  ]) {
    assert.ok(
      queries.some(
        (q) =>
          q.sql.startsWith(`INSERT INTO ${table} `) && q.sql.includes("ON CONFLICT (id) DO UPDATE"),
      ),
    );
    const deletes = queries.filter((q) => q.sql.startsWith(`DELETE FROM ${table}`));
    assert.equal(deletes.length, 1);
    assert.equal(deletes[0].sql, `DELETE FROM ${table} WHERE NOT (id = ANY($1::text[]))`);
    assert.deepEqual(deletes[0].values, [[id]]);
  }
  assert.ok(!queries.some((q) => /(?:DELETE FROM|INSERT INTO|UPDATE) ai_calls\b/.test(q.sql)));
});
