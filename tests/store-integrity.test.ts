import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppData } from "../src/lib/data-model";
import { assertNewRecordParents, captureRecordIds } from "../src/lib/server/store-integrity.server";

function fixture() {
  return { users: [{ id: "u", auth: { deleting: false } }], workspaces: [{ id: "w" }, { id: "other" }], memberships: [{ id: "m", workspaceId: "w", userId: "u" }], brands: [{ id: "b", workspaceId: "w" }], brandProfiles: [], posts: [], postVariants: [], postVersions: [], campaigns: [], planItems: [], mediaAssets: [], aiJobs: [], analyticsSnapshots: [], channelConnections: [], channelOAuthStates: [], channelOAuthSelections: [], publishAttempts: [] } as unknown as AppData;
}
test("new rows cannot outlive deleted parents or cross workspace/brand boundaries", () => {
  const db = fixture(); const before = captureRecordIds(db);
  db.posts.push({ id: "p", workspaceId: "w", brandId: "b" } as AppData["posts"][number]);
  assert.doesNotThrow(() => assertNewRecordParents(db, before));
  db.posts[0].workspaceId = "other";
  assert.throws(() => assertNewRecordParents(db, before), /mentés/);
  db.posts[0].workspaceId = "w"; db.brands = [];
  assert.throws(() => assertNewRecordParents(db, before), /mentés/);
});
test("in-flight writes cannot resurrect data after account deletion starts", () => {
  const db = fixture(); const before = captureRecordIds(db);
  db.users[0].auth!.deleting = true;
  db.mediaAssets.push({ id: "media", workspaceId: "w", brandId: "b" } as AppData["mediaAssets"][number]);
  assert.throws(() => assertNewRecordParents(db, before), /mentés/);
  db.users = []; db.workspaces = []; db.brands = [];
  assert.throws(() => assertNewRecordParents(db, before), /mentés/);
});
test("a new version requires a real parent post", () => {
  const db = fixture(); const before = captureRecordIds(db);
  db.postVersions.push({ id: "version", postId: "missing" } as AppData["postVersions"][number]);
  assert.throws(() => assertNewRecordParents(db, before), /mentés/);
});
