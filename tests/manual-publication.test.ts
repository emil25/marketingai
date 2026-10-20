import assert from "node:assert/strict";
import { test } from "node:test";
import { markManualPublication } from "../src/lib/server/manual-publication.server";
import type { AppData, WorkspaceSnapshot } from "../src/lib/data-model";
test("manual publication requires ownership and complete text; creates one real Calendar entry and is idempotent", () => {
  const db = { posts: [{ id: "p", workspaceId: "w", brandId: "b", platforms: ["facebook", "instagram"], timezone: "Europe/Bucharest", title: "Test", goal: "Test", status: "draft" }], postVariants: [{ id: "v", postId: "p", platform: "facebook", content: "Cím: [cím]. Írj nekünk!", cta: "Írj nekünk!", hashtags: [], status: "draft" }, { id: "ig", postId: "p", platform: "instagram", status: "draft" }], planItems: [] } as unknown as AppData;
  const context = { workspace: { id: "w" }, brands: [{ id: "b", workspaceId: "w" }] } as WorkspaceSnapshot;
  assert.throws(() => markManualPublication(db, { ...context, workspace: { id: "foreign" } } as WorkspaceSnapshot, "p", "v"), /hozzáférés/);
  assert.throws(() => markManualPublication(db, context, "p", "foreign"), /hozzáférés/);
  assert.throws(() => markManualPublication(db, context, "p", "v"), /hiányzó adatokat/);
  assert.equal(db.planItems.length, 0);
  db.postVariants[0].content = "Cím: Fő utca 1. Írj nekünk!";
  markManualPublication(db, context, "p", "v", "2026-10-08T10:00:00.000Z");
  markManualPublication(db, context, "p", "v", "2026-10-08T11:00:00.000Z");
  assert.equal(db.planItems.length, 1); assert.equal(db.planItems[0].time, "13:00");
  assert.equal(db.planItems[0].status, "published"); assert.equal(db.posts[0].status, "draft");
  assert.equal(db.postVariants[0].manualPublishedAt, "2026-10-08T10:00:00.000Z");
});
