import { contentPlaceholders } from "./content-quality";
import type { ChannelConnectionStatus, PostPlatform, PostVariantRecord } from "./data-model";

type PublicationConnection = {
  status: ChannelConnectionStatus;
  hasAccessToken: boolean;
  scopes: string[];
};

export function publicationBlockReason(
  platform: "facebook" | "instagram",
  connection: PublicationConnection | undefined,
  variant:
    | (Pick<PostVariantRecord, "content" | "status"> &
        Partial<Pick<PostVariantRecord, "cta" | "hashtags">>)
    | undefined,
  hasJpeg: boolean,
): string | null {
  if (contentPlaceholders(variant?.content, variant?.cta, ...(variant?.hashtags ?? [])).length)
    return "Előbb töltsd ki a szögletes zárójeles adatokat a posztban.";
  if (variant?.status === "published") return "Ez a változat már közzé van téve.";
  if (!connection || connection.status !== "connected" || !connection.hasAccessToken)
    return `Csatlakoztasd ${platform === "facebook" ? "a Facebook-oldaladat" : "az Instagram-fiókodat"} a közzétételhez.`;
  const permission = platform === "facebook" ? "pages_manage_posts" : "instagram_content_publish";
  if (!connection.scopes.includes(permission))
    return "Csatlakoztasd újra a csatornát a közzétételi engedély megadásához.";
  if (!variant?.content.trim()) return "Előbb készíts posztszöveget ehhez a csatornához.";
  if (platform === "instagram" && !hasJpeg)
    return "Az Instagramhoz adj JPEG képet a poszthoz a Kép vagy videó részben.";
  return null;
}

export async function saveThenPublish<T>(
  saveEditedText: () => Promise<unknown>,
  publishSavedText: () => Promise<T>,
): Promise<T> {
  await saveEditedText();
  return publishSavedText();
}

export function defaultPostPlatforms(
  saved?: PostPlatform[],
  variants: Array<Pick<PostVariantRecord, "platform">> = [],
): PostPlatform[] {
  const platforms = saved?.length ? saved : variants.map((variant) => variant.platform);
  return platforms.length ? [...new Set(platforms)] : ["facebook"];
}

export function postCopyText(
  variant: Pick<PostVariantRecord, "content" | "cta" | "hashtags">,
): string {
  const content = variant.content.trim();
  const cta = variant.cta.trim();
  const hashtags = [...new Set(variant.hashtags.map((tag) => tag.trim().replace(/^#+/, "")))]
    .filter(Boolean)
    .map((tag) => `#${tag}`)
    .filter((tag) => !`${content} ${cta}`.split(/\s+/).includes(tag));
  return [content, cta && !content.includes(cta) ? cta : "", hashtags.join(" ")]
    .filter(Boolean)
    .join("\n\n");
}

export function postTitle(title: string, brief: string): string {
  return title.trim() || brief.trim().slice(0, 80) || "Névtelen poszt";
}
