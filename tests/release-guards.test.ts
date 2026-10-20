import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertProductionConfiguration } from "../src/lib/server/production-config.server";
import { allowBuildMigration, neonTargetFingerprint } from "../scripts/build-migration-policy.mjs";
import { loadMigrationEnvironment } from "../scripts/migration-env.mjs";
import { withProjectCrons } from "../scripts/vercel-cron-output.mjs";

const valid = {
  NODE_ENV: "production",
  SESSION_SECRET: "s".repeat(40),
  DATABASE_URL: "present",
  PUBLIC_APP_URL: "https://app.example.com",
};
test("production startup rejects unsafe flags, short secret, local/non-HTTPS origins and missing database without revealing values", () => {
  assert.doesNotThrow(() => assertProductionConfiguration(valid));
  assert.doesNotThrow(() => assertProductionConfiguration({ NODE_ENV: "development" }));
  for (const flag of [
    "ENABLE_LOCAL_ADMIN_LOGIN",
    "MARKETINGPILOT_PREVIEW_TEST_AI",
    "MARKETINGPILOT_JSON_FIXTURE",
  ]) {
    for (const value of ["true", "1", "TRUE", "yes"])
      assert.throws(
        () => assertProductionConfiguration({ ...valid, [flag]: value }),
        new RegExp(flag),
      );
    assert.doesNotThrow(() => assertProductionConfiguration({ ...valid, [flag]: "false" }));
  }
  for (const PUBLIC_APP_URL of [
    "",
    "http://app.example.com",
    "https://localhost",
    "https://localhost.",
    "https://127.0.0.1",
    "https://[::1]",
    "https://[::ffff:127.0.0.1]",
    "https://dev.localhost",
    "https://secret@host.example",
    "https://example.com/?token=secret",
  ]) {
    try {
      assertProductionConfiguration({ ...valid, PUBLIC_APP_URL });
      assert.fail();
    } catch (error) {
      assert.match(String(error), /PUBLIC_APP_URL/);
      assert.ok(!String(error).includes("secret@"));
      assert.ok(!String(error).includes("token=secret"));
    }
  }
  assert.throws(
    () => assertProductionConfiguration({ ...valid, SESSION_SECRET: "tiny-private-value" }),
    /32 karakter/,
  );
  assert.throws(
    () => assertProductionConfiguration({ ...valid, DATABASE_URL: "", DIRECT_URL: "present" }),
    /DATABASE_URL/,
  );
  assert.throws(
    () =>
      assertProductionConfiguration({
        ...valid,
        NODE_ENV: "development",
        VERCEL_ENV: "production",
        ENABLE_LOCAL_ADMIN_LOGIN: "true",
      }),
    /tiltott/,
  );
  assert.throws(
    () =>
      assertProductionConfiguration({
        ...valid,
        VERCEL_ENV: "preview",
        MARKETINGPILOT_PREVIEW_TEST_AI: "true",
      }),
    /tiltott/,
  );
});
const previewUrl = "postgres://test:private@ep-preview-a1.eu-central-1.aws.neon.tech/neondb";
const productionUrl = "postgres://test:private@ep-production-b2.eu-central-1.aws.neon.tech/neondb";
const preview = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  MIGRATE_ON_BUILD: "preview-isolated",
  DATABASE_URL: previewUrl,
  PREVIEW_DATABASE_TARGET_SHA256: neonTargetFingerprint(previewUrl),
  PRODUCTION_DATABASE_TARGET_SHA256: neonTargetFingerprint(productionUrl),
};
test("build never migrates by default; explicit preview needs separate pinned runtime and migration database targets", () => {
  assert.equal(allowBuildMigration({ VERCEL_ENV: "production" }), false);
  assert.equal(allowBuildMigration({ VERCEL_ENV: "preview" }), false);
  assert.equal(allowBuildMigration(preview), true);
  assert.equal(
    allowBuildMigration({
      ...preview,
      DIRECT_URL: previewUrl.replace("ep-preview-a1.", "ep-preview-a1-pooler."),
    }),
    true,
  );
  for (const changes of [
    { VERCEL: "" },
    { VERCEL_ENV: "production" },
    { VERCEL_ENV: "development" },
    { PRODUCTION_DATABASE_TARGET_SHA256: "" },
    { DATABASE_URL: productionUrl },
    { DIRECT_URL: productionUrl },
    { DATABASE_URL_UNPOOLED: productionUrl },
    { DATABASE_URL: "postgres://private@localhost/db" },
    { PREVIEW_DATABASE_TARGET_SHA256: preview.PRODUCTION_DATABASE_TARGET_SHA256 },
  ])
    assert.throws(() => allowBuildMigration({ ...preview, ...changes }));
  const script = readFileSync("scripts/build-vercel.mjs", "utf8");
  assert.ok(!script.includes("import-private-snapshot"));
  assert.match(script, /if \(migratePreview\) await run/);
  const migration = readFileSync("scripts/migrate-postgres.mjs", "utf8");
  assert.match(migration, /loadMigrationEnvironment\(process.env/);
  assert.ok(!migration.includes("error.message"));
});
test("injected migration connections never inherit another direct database from a local env file", () => {
  for (const config of [
    { DATABASE_URL: previewUrl },
    { DIRECT_URL: previewUrl },
    { VERCEL: "1" },
  ]) {
    const state = { ...config };
    let read = false;
    loadMigrationEnvironment(state, () => {
      read = true;
      return `DIRECT_URL=${productionUrl}`;
    });
    assert.equal(read, false);
    assert.deepEqual(state, config);
  }
  const local = { SESSION_SECRET: "injected-value" };
  loadMigrationEnvironment(local, () => `DATABASE_URL='${previewUrl}'\nSESSION_SECRET=from-file\n`);
  assert.equal(local.SESSION_SECRET, "injected-value");
  assert.equal((local as Record<string, string>).DATABASE_URL, previewUrl);
});
test("prebuilt Vercel output contains the daily protected route schedule without losing routing metadata", () => {
  const project = JSON.parse(readFileSync("vercel.json", "utf8"));
  const output = { version: 3, routes: [{ handle: "filesystem" }] };
  const configured = withProjectCrons(output, project);
  assert.deepEqual(configured.routes, output.routes);
  assert.deepEqual(configured.crons, [{ path: "/api/cron/ai-monitor", schedule: "0 6 * * *" }]);
  assert.ok(!("crons" in output));
  assert.throws(() => withProjectCrons(output, {}));
  assert.throws(() => withProjectCrons(output, { crons: [{ path: "/api/cron?secret=value", schedule: "0 6 * * *" }] }));
});
