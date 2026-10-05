import type { AppData, WorkspaceSnapshot } from "@/lib/data-model";
import { VIDEO_IMAGE_TYPES } from "@/lib/video";

export function ownedVideoContext(
  database: AppData,
  context: WorkspaceSnapshot,
  postId: string,
  imageIds: string[],
) {
  if (
    !database.memberships.some(
      (item) => item.userId === context.user.id && item.workspaceId === context.workspace.id,
    )
  ) {
    throw new Error("Nincs hozzáférés ehhez a munkatérhez.");
  }
  const post = database.posts.find(
    (item) => item.id === postId && item.workspaceId === context.workspace.id,
  );
  const brand =
    post &&
    database.brands.find(
      (item) => item.id === post.brandId && item.workspaceId === context.workspace.id,
    );
  const profile = brand && database.brandProfiles.find((item) => item.brandId === brand.id);
  if (!post || !brand || !profile)
    throw new Error("Nincs hozzáférés ehhez a poszthoz vagy márkához.");
  if (new Set(imageIds).size !== imageIds.length)
    throw new Error("Egy képet csak egyszer válassz ki.");
  const images = imageIds.map((id) =>
    database.mediaAssets.find(
      (item) =>
        item.id === id && item.workspaceId === post.workspaceId && item.brandId === post.brandId,
    ),
  );
  if (
    images.some(
      (image) =>
        !image || !VIDEO_IMAGE_TYPES.includes(image.mimeType) || image.size > 10 * 1024 * 1024,
    )
  ) {
    throw new Error(
      "Csak ennek a márkának a legfeljebb 10 MB méretű JPG, PNG vagy WebP képei használhatók.",
    );
  }
  const campaign = post.campaignId
    ? database.campaigns.find(
        (item) =>
          item.id === post.campaignId &&
          item.workspaceId === post.workspaceId &&
          item.brandId === brand.id,
      )
    : undefined;
  return { post, brand, profile, campaign };
}
