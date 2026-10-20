import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppData, PlanItemRecord } from "../src/lib/data-model";
import { plannerContentPreview } from "../src/lib/server/planner-preview.server";

test("calendar shows current platform text, CTA, hashtags and scoped real image", () => {
  const item = {
    workspaceId: "w1",
    brandId: "b1",
    postId: "p1",
    platform: "instagram",
    topic: "Kenyér",
    draftContent: "Régi vázlat",
  } as PlanItemRecord;
  const db = {
    posts: [{ id: "p1", workspaceId: "w1", brandId: "b1", mediaAssetIds: ["foreign", "image"] }],
    postVariants: [
      {
        postId: "p1",
        platform: "facebook",
        content: "Facebook szöveg",
        cta: "",
        hashtags: [],
        updatedAt: "2026-10-09",
      },
      {
        postId: "p1",
        platform: "instagram",
        content: "Szerkesztett kenyér",
        cta: "Írj nekünk",
        hashtags: ["pékség"],
        updatedAt: "2026-10-09",
      },
    ],
    mediaAssets: [
      { id: "foreign", workspaceId: "w2", brandId: "b2", mimeType: "image/png", altText: "Privát" },
      {
        id: "image",
        workspaceId: "w1",
        brandId: "b1",
        mimeType: "image/png",
        altText: "Kenyérfotó",
      },
    ],
  } as unknown as AppData;
  assert.equal(
    plannerContentPreview(db, item).postContent,
    "Szerkesztett kenyér\n\nÍrj nekünk\n\n#pékség",
  );
  assert.deepEqual(plannerContentPreview(db, item).postImage, {
    id: "image",
    altText: "Kenyérfotó",
  });
  db.posts[0].brandId = "other-owned-brand";
  assert.equal(plannerContentPreview(db, item).post, null);
  assert.equal(plannerContentPreview(db, item).postContent, "Régi vázlat");
  assert.equal(plannerContentPreview(db, item).postImage, null);
  db.posts[0].brandId = "b1";
  db.posts[0].workspaceId = "w2";
  assert.equal(plannerContentPreview(db, item).post, null);
});
