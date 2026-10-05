import type { AppData, WorkspaceSnapshot } from "@/lib/data-model";
import { creativeImageIds, type CreativeDraft } from "@/lib/post-creative";

export function ownedCreativeContext(
  db: AppData,
  context: WorkspaceSnapshot,
  postId: string,
  draft?: CreativeDraft,
  writable = false,
) {
  if (
    !db.memberships.some(
      (item) => item.workspaceId === context.workspace.id && item.userId === context.user.id,
    )
  )
    throw new Error("Nincs hozzáférés ehhez a munkatérhez.");
  const post = db.posts.find(
    (item) => item.id === postId && item.workspaceId === context.workspace.id,
  );
  const brand =
    post &&
    db.brands.find((item) => item.id === post.brandId && item.workspaceId === context.workspace.id);
  const profile = brand && db.brandProfiles.find((item) => item.brandId === brand.id);
  if (!post || !brand || !profile)
    throw new Error("Nincs hozzáférés ehhez a poszthoz vagy márkához.");
  if (
    writable &&
    (post.status === "published" ||
      db.postVariants.some((item) => item.postId === post.id && item.status === "published"))
  )
    throw new Error("Közzétett poszt képei nem cserélhetők. Készíts másolatot a posztról.");
  if (draft)
    for (const id of creativeImageIds(draft)) {
      const image = db.mediaAssets.find(
        (item) =>
          item.id === id && item.workspaceId === post.workspaceId && item.brandId === post.brandId,
      );
      if (
        !image ||
        !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(image.mimeType)
      )
        throw new Error("Csak ennek a márkának a saját képei használhatók.");
    }
  const campaign = db.campaigns.find(
    (item) =>
      item.id === post.campaignId &&
      item.workspaceId === post.workspaceId &&
      item.brandId === post.brandId,
  );
  return { post, brand, profile, campaign };
}
