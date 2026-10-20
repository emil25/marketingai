import type { AppData, WorkspaceSnapshot } from "../data-model";
import { assertContentReady } from "../content-quality";
import { formatPostScheduleInput } from "../post-schedule";
import { newId } from "./store.server";
export function markManualPublication(
  db: AppData,
  context: WorkspaceSnapshot,
  postId: string,
  variantId: string,
  timestamp = new Date().toISOString(),
) {
  const post = db.posts.find(
    (p) =>
      p.id === postId &&
      p.workspaceId === context.workspace.id &&
      context.brands.some((b) => b.id === p.brandId && b.workspaceId === p.workspaceId),
  );
  const variant = db.postVariants.find((v) => v.id === variantId && v.postId === post?.id);
  if (!post || !variant) throw new Error("Nincs hozzáférés ehhez a posztváltozathoz.");
  if (!variant.content.trim()) throw new Error("Előbb töltsd ki a poszt szövegét.");
  assertContentReady(variant.content, variant.cta, ...variant.hashtags);
  variant.status = "published";
  variant.manualPublishedAt ??= timestamp;
  variant.updatedAt = timestamp;
  const selected = post.platforms?.length
    ? post.platforms
    : db.postVariants.filter((v) => v.postId === postId).map((v) => v.platform);
  if (
    selected.every((platform) =>
      db.postVariants.some(
        (v) => v.postId === postId && v.platform === platform && v.status === "published",
      ),
    )
  )
    post.status = "published";
  post.updatedAt = timestamp;
  const local = formatPostScheduleInput(variant.manualPublishedAt, post.timezone);
  if (!local) throw new Error("Az időzóna nem megfelelő. Javítsd a poszt beállításaiban.");
  const linked = db.planItems.filter(
    (p) =>
      p.postId === postId &&
      p.workspaceId === post.workspaceId &&
      p.brandId === post.brandId &&
      p.platform === variant.platform,
  );
  if (!linked.length)
    db.planItems.push({
      id: newId("plan"),
      workspaceId: post.workspaceId,
      brandId: post.brandId,
      campaignId: post.campaignId ?? null,
      postId,
      platform: variant.platform,
      date: local.slice(0, 10),
      time: local.slice(11, 16),
      timezone: post.timezone,
      topic: post.title,
      objective: post.goal,
      contentType: "szöveges",
      status: "published",
      aiGenerated: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  for (const item of linked) {
    item.status = "published";
    item.date = local.slice(0, 10);
    item.time = local.slice(11, 16);
    item.updatedAt = timestamp;
  }
}
