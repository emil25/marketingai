import assert from "node:assert/strict";
import { test } from "node:test";
import { demoFixture, QA_BRANDS } from "../scripts/demo-fixture";
import { assertNewRecordParents, captureRecordIds } from "../src/lib/server/store-integrity.server";

test("fictional demo and five-brand QA fixtures have scoped parents and no external connections or analytics", () => {
  for (const includeContent of [true, false]) {
    const { db, credentials } = demoFixture(includeContent);
    const empty = Object.fromEntries(Object.keys(db).map((key) => [key, []])) as typeof db;
    assert.doesNotThrow(() => assertNewRecordParents(db, captureRecordIds(empty)));
    assert.equal(db.users.length, includeContent ? 1 : 5);
    assert.ok(db.users.every((user) => user.email.endsWith("@example.invalid")));
    assert.ok(db.brands.every((brand) => brand.name.startsWith("Példa ")));
    assert.equal(db.channelConnections.length, 0);
    assert.equal(db.analyticsSnapshots.length, 0);
    assert.equal(db.publishAttempts.length, 0);
    assert.equal(new Set(credentials.map((c) => c.password)).size, credentials.length);
    assert.ok(credentials.every((c) => c.password.length >= 32));
    if (includeContent) {
      assert.deepEqual(
        new Set(db.posts.map((post) => post.status)),
        new Set(["draft", "review", "published"]),
      );
      assert.equal(db.campaigns.length, 2);
    } else {
      assert.equal(db.posts.length, 0);
      assert.deepEqual(
        db.brandProfiles.map((p) => p.businessType),
        QA_BRANDS.map((b) => b.type),
      );
    }
  }
});
