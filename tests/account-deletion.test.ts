import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppData } from "../src/lib/data-model";
import { removeAccountReferences } from "../src/lib/server/account-deletion.server";

test("deleting a member clears personal FK/OAuth references while preserving shared content", () => {
  const db = {
    posts: [{ id: "shared-post" }],
    postVersions: [
      { id: "own", postId: "shared-post", createdBy: "deleted" },
      { id: "other", postId: "shared-post", createdBy: "remaining" },
    ],
    channelOAuthStates: [
      { state: "own", userId: "deleted" },
      { state: "other", userId: "remaining" },
    ],
    channelOAuthSelections: [
      { id: "own", userId: "deleted" },
      { id: "other", userId: "remaining" },
    ],
  } as unknown as AppData;
  removeAccountReferences(db, "deleted");
  assert.deepEqual(
    db.postVersions.map((v) => v.id),
    ["other"],
  );
  assert.deepEqual(
    db.channelOAuthStates.map((v) => v.state),
    ["other"],
  );
  assert.deepEqual(
    db.channelOAuthSelections.map((v) => v.id),
    ["other"],
  );
  assert.equal(db.posts[0].id, "shared-post");
  removeAccountReferences(db, "deleted");
  assert.equal(db.postVersions.length, 1);
});
