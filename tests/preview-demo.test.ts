import test from "node:test";
import assert from "node:assert/strict";
import type { AppData } from "../src/lib/data-model";
import {
  ensurePreviewDemoAccount,
  previewDemoLoginEnabled,
} from "../src/lib/server/preview-demo.server";

function emptyData(): AppData {
  return {
    users: [],
    workspaces: [],
    memberships: [],
    brands: [],
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
  };
}

test("shared demo access is limited to the private Preview branch", () => {
  const preview = {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: "codex/mobile-simple-preview",
    BETA_MODE: "private",
    BETA_INVITE_CODE: "configured-but-never-exposed",
  };
  assert.equal(previewDemoLoginEnabled(preview), true);
  assert.equal(previewDemoLoginEnabled({ ...preview, VERCEL_ENV: "production" }), false);
  assert.equal(previewDemoLoginEnabled({ ...preview, VERCEL_GIT_COMMIT_REF: "main" }), false);
  assert.equal(previewDemoLoginEnabled({ ...preview, BETA_MODE: "off" }), false);
  assert.equal(previewDemoLoginEnabled({ ...preview, BETA_INVITE_CODE: "" }), false);
  assert.equal(previewDemoLoginEnabled({ ...preview, VERCEL: undefined }), false);
});

test("demo account creation is persistent and never resets the user's saved changes", async () => {
  const data = emptyData();
  let passwordHashes = 0;
  const makeHash = async () => {
    passwordHashes += 1;
    return "unusable-random-preview-password-hash";
  };
  const first = await ensurePreviewDemoAccount(data, makeHash, "2026-10-21T10:00:00.000Z");
  assert.equal(data.users.length, 1);
  assert.equal(data.workspaces.length, 1);
  assert.equal(data.brands.length, 1);
  assert.equal(data.brandProfiles.length, 1);
  assert.equal(first.brand.name, "Példa Pékség");
  assert.equal(first.user.auth?.emailVerifiedAt, null);

  first.brand.name = "Saját próbanév";
  data.brandProfiles[0]!.tone = "Játékos";
  const second = await ensurePreviewDemoAccount(
    data,
    async () => {
      throw new Error("A meglévő fiók jelszavát nem szabad újragenerálni.");
    },
    "2026-10-22T10:00:00.000Z",
  );
  assert.equal(passwordHashes, 1);
  assert.equal(second.user.id, first.user.id);
  assert.equal(data.users.length, 1);
  assert.equal(data.workspaces.length, 1);
  assert.equal(data.brands.length, 1);
  assert.equal(second.brand.name, "Saját próbanév");
  assert.equal(data.brandProfiles[0]!.tone, "Játékos");
});
