import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { Pool, types } from "pg";

// Driver-boundary regression test, not a real database or production fixture.
// Replace connect before importing the adapter; never open a network connection.
const timestamp = "2026-10-06T18:19:23.000Z";
const driverDate = types.getTypeParser(1184)("2026-10-06 18:19:23+00") as Date;
assert.ok(driverDate instanceof Date);
const tables = [
  "users",
  "workspaces",
  "memberships",
  "brands",
  "brand_profiles",
  "campaigns",
  "posts",
  "post_variants",
  "post_versions",
  "plan_items",
  "media_assets",
  "analytics_snapshots",
  "ai_jobs",
  "channel_connections",
  "channel_oauth_states",
  "channel_oauth_selections",
  "publish_attempts",
];
const timestampColumns = new Set([
  "created_at",
  "updated_at",
  "learned_at",
  "scheduled_at",
  "completed_at",
  "token_expires_at",
  "connected_at",
  "expires_at",
  "requested_at",
  "started_at",
  "last_seen_at",
]);
let optionalDate: unknown = driverDate;
let commands: string[] = [];
let writes = 0;
let failInsert = false;
const client = {
  async query(sql: string, values: unknown[] = []) {
    commands.push(sql);
    const table = /^SELECT \* FROM (\w+)$/.exec(sql)?.[1];
    if (table && tables.includes(table)) {
      return {
        rows: [
          {
            id: `test_${table}`,
            workspace_id: "test_workspaces",
            brand_id: "test_brands",
            post_id: "test_posts",
            user_id: "test_users",
            created_by: "test_users",
            created_at: driverDate,
            updated_at: driverDate,
            requested_at: driverDate,
            expires_at: driverDate,
            learned_at: optionalDate,
            scheduled_at: optionalDate,
            completed_at: optionalDate,
            token_expires_at: optionalDate,
            connected_at: optionalDate,
            started_at: optionalDate,
            start_date: "2026-10-07",
            end_date: "2026-11-05",
            date: "2026-10-07",
            time: "10:00",
            name: "Regression fixture",
            role: "owner",
            language: "magyar",
            timezone: "Europe/Bucharest",
            channels: ["facebook"],
            platforms: ["facebook"],
            status: "draft",
            business_type: "other",
            type: "campaign_plan",
            provider: "facebook",
            access_token: null,
            external_account_id: "external_test_id",
          },
        ],
      };
    }
    if (sql.startsWith("INSERT INTO ")) {
      if (failInsert) throw new Error("Simulated insert failure");
      const columns =
        /\(([^)]+)\) VALUES/
          .exec(sql)?.[1]
          .split(", ")
          .map((c) => c.replaceAll('"', "")) ?? [];
      columns.forEach((column, index) => {
        if (!timestampColumns.has(column) || values[index] == null) return;
        assert.equal(typeof values[index], "string", `${column} must be an ISO timestamp`);
        assert.match(
          values[index] as string,
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
          `${column} must round-trip in PostgreSQL`,
        );
      });
      writes++;
    }
    return { rows: [] };
  },
  release() {},
};
const originalConnect = Pool.prototype.connect;
Pool.prototype.connect = (async () => client) as unknown as typeof originalConnect;
process.env.DATABASE_URL = "postgresql://test.invalid/driver-boundary-test";
delete process.env.DIRECT_URL;
const adapterPath = process.env.MARKETINGPILOT_ADAPTER_TEST_PATH;
const adapter = await import(
  adapterPath ? pathToFileURL(adapterPath).href : "../src/lib/server/postgres-store.server.ts"
);

try {
  for (const value of [driverDate, timestamp, null]) {
    optionalDate = value;
    const data = await adapter.readPostgresData();
    const expected = value == null ? null : timestamp;
    assert.equal(data.brandProfiles[0].learnedAt, expected);
    assert.equal(data.posts[0].scheduledAt, expected);
    assert.equal(data.aiJobs[0].completedAt, expected ?? undefined);
    assert.equal(data.channelConnections[0].tokenExpiresAt, expected);
    assert.equal(data.channelConnections[0].connectedAt, expected);
    assert.equal(data.publishAttempts[0].startedAt, expected ?? undefined);
    assert.equal(data.publishAttempts[0].completedAt, expected ?? undefined);
    assert.equal(data.channelConnections[0].externalAccountId, "external_test_id");
    assert.equal(data.planItems[0].date, "2026-10-07");
    assert.equal(data.planItems[0].time, "10:00");
    commands = [];
    writes = 0;
    await adapter.postgresTransact((snapshot: typeof data) => {
      snapshot.campaigns.push({
        ...snapshot.campaigns[0],
        id: "test_new_campaign",
        name: "New test campaign",
      });
    });
    assert.ok(writes >= tables.length);
    assert.equal(commands.at(-1), "COMMIT");
    assert.ok(!commands.includes("ROLLBACK"));
  }
  failInsert = true;
  commands = [];
  await assert.rejects(
    adapter.postgresTransact(() => undefined),
    /Simulated insert failure/,
  );
  assert.equal(commands.at(-1), "ROLLBACK");
  assert.ok(!commands.includes("COMMIT"));
  console.log(
    "PASS: pg Date, ISO string and NULL timestamp reads; campaign snapshot write bindings; rollback on failure.",
  );
} finally {
  await adapter.closePostgresPool();
  Pool.prototype.connect = originalConnect;
}
