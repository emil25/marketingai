import { z } from "zod";

export const CREATIVE_FORMATS = {
  portrait: { label: "Instagram · 4:5", width: 1080, height: 1350 },
  square: { label: "Négyzet · 1:1", width: 1080, height: 1080 },
} as const;
export const CreativeSlideSchema = z.object({
  headline: z.string().trim().min(1).max(100),
  body: z.string().trim().max(260),
  cta: z.string().trim().max(70),
  imageId: z
    .string()
    .regex(/^media_[a-f0-9-]+$/i)
    .nullable(),
});
export const CreativeDraftSchema = z.object({
  format: z.enum(["portrait", "square"]),
  template: z.enum(["editorial", "overlay", "minimal"]),
  slides: z.array(CreativeSlideSchema).min(1).max(6),
  caption: z.string().trim().max(2200),
});
export type CreativeDraft = z.infer<typeof CreativeDraftSchema>;
export type CreativeSlide = z.infer<typeof CreativeSlideSchema>;

export function creativeImageIds(draft: CreativeDraft) {
  return [...new Set(draft.slides.flatMap((slide) => (slide.imageId ? [slide.imageId] : [])))];
}

export function creativeColor(colors: string[]) {
  return colors.find((color) => /^#[\da-f]{6}$/i.test(color)) ?? "#ee684e";
}

/** Inspect actual JPEG SOF dimensions, not the filename or caller-supplied MIME type. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) return null;
      return {
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
      };
    }
    offset += length;
  }
  return null;
}

/** Latest explicit creative selection only; removed slides must never be silently published. */
export function selectedCreativeIds(
  jobs: Array<{
    workspaceId: string;
    brandId: string;
    status: string;
    input: Record<string, unknown>;
  }>,
  post: { id: string; workspaceId: string; brandId: string; mediaAssetIds: string[] },
) {
  const job = [...jobs]
    .reverse()
    .find(
      (item) =>
        item.workspaceId === post.workspaceId &&
        item.brandId === post.brandId &&
        item.status === "completed" &&
        item.input.kind === "creative_render" &&
        item.input.postId === post.id,
    );
  const ids = Array.isArray(job?.input.assetIds) ? job.input.assetIds : [];
  return ids.filter(
    (id): id is string => typeof id === "string" && post.mediaAssetIds.includes(id),
  );
}
