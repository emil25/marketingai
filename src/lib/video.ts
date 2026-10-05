import { z } from "zod";

export const VIDEO_FORMATS = {
  portrait: { label: "Reels / TikTok · 9:16", width: 720, height: 1280 },
  square: { label: "Négyzet · 1:1", width: 720, height: 720 },
} as const;
export const VideoFormatSchema = z.enum(["portrait", "square"]);
export const VideoSceneSchema = z.object({
  mediaAssetId: z.string().regex(/^media_[a-f0-9-]+$/i),
  caption: z.string().trim().min(1).max(160),
  duration: z.number().int().min(3).max(8),
});
export const VideoScenesSchema = z.array(VideoSceneSchema).min(1).max(6);
export type VideoScene = z.infer<typeof VideoSceneSchema>;
export type VideoFormat = z.infer<typeof VideoFormatSchema>;
export const VIDEO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Captions are written to text files, never interpolated into shell/filter code. */
export function wrapVideoCaption(text: string, columns = 28) {
  const lines: string[] = [];
  let line = "";
  for (const word of text
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)) {
    const chunks = word.match(new RegExp(`.{1,${columns}}`, "gu")) ?? [];
    for (const chunk of chunks) {
      if (line && line.length + chunk.length + 1 > columns) {
        lines.push(line);
        line = "";
      }
      line += (line ? " " : "") + chunk;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}
