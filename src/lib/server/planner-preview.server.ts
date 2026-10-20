import type { AppData, PlanItemRecord } from "../data-model";
import { postCopyText } from "../post-editor";

/** Use only the linked post's current, scoped platform variant and private media. */
export function plannerContentPreview(database: AppData, item: PlanItemRecord) {
  const post = database.posts.find(
    (candidate) =>
      candidate.id === item.postId &&
      candidate.workspaceId === item.workspaceId &&
      candidate.brandId === item.brandId,
  );
  const variant =
    post &&
    database.postVariants
      .filter((candidate) => candidate.postId === post.id && candidate.platform === item.platform)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const image =
    post &&
    database.mediaAssets.find(
      (candidate) =>
        post.mediaAssetIds.includes(candidate.id) &&
        candidate.workspaceId === item.workspaceId &&
        candidate.brandId === item.brandId &&
        candidate.mimeType.startsWith("image/"),
    );
  return {
    post: post ?? null,
    postContent: variant ? postCopyText(variant) : item.draftContent?.trim() || null,
    postImage: image ? { id: image.id, altText: image.altText || post?.title || item.topic } : null,
  };
}
