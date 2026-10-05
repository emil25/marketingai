import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildBusinessContext, businessContextPrompt } from "@/lib/business-types";
import { VideoFormatSchema, VideoScenesSchema } from "@/lib/video";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import { openRouterChat } from "@/lib/server/ai-provider.server";
import { ownedVideoContext } from "@/lib/server/video-context.server";
import { renderPhotoVideo } from "@/lib/server/video-render.server";
import {
  readData,
  transact,
  newId,
  nowIso,
  createAiJob,
  startAiJob,
  completeAiJob,
  writeMediaFile,
  removeMediaFile,
} from "@/lib/server/store.server";
import type { MediaAssetRecord } from "@/lib/data-model";

const PostIdSchema = z.object({ postId: z.string().min(1).max(100) });
const StoryboardInput = PostIdSchema.extend({
  imageIds: z
    .array(z.string().regex(/^media_[a-f0-9-]+$/i))
    .min(1)
    .max(6),
  content: z.string().trim().min(2).max(6000),
  format: VideoFormatSchema,
});
const RenderInput = PostIdSchema.extend({ scenes: VideoScenesSchema, format: VideoFormatSchema });

export const getPostVideoDraft = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => PostIdSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const db = await readData();
    const { post } = ownedVideoContext(db, context, data.postId, []);
    const job = [...db.aiJobs]
      .reverse()
      .find(
        (item) =>
          item.workspaceId === post.workspaceId &&
          item.brandId === post.brandId &&
          item.status === "completed" &&
          item.input.postId === post.id &&
          ["video_storyboard", "video_render"].includes(String(item.input.kind)),
      );
    const scenes = VideoScenesSchema.safeParse(job?.input.scenes);
    const format = VideoFormatSchema.safeParse(job?.input.format);
    // Deleted source photos make a saved storyboard unusable; never return stale references.
    if (scenes.success && format.success) {
      try {
        ownedVideoContext(
          db,
          context,
          post.id,
          scenes.data.map((item) => item.mediaAssetId),
        );
      } catch {
        return null;
      }
      return { scenes: scenes.data, format: format.data };
    }
    return null;
  });

export const generateVideoStoryboard = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => StoryboardInput.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const { post, brand, profile, campaign } = ownedVideoContext(
      await readData(),
      context,
      data.postId,
      data.imageIds,
    );
    const businessContext = buildBusinessContext(brand, profile, {
      goal: post.goal,
      audience: post.audience || brand.audience,
      language: post.language,
      platform: data.format === "portrait" ? "Instagram Reels / TikTok" : "Facebook / Instagram",
    });
    const job = await transact((db) =>
      createAiJob(db, {
        workspaceId: post.workspaceId,
        brandId: post.brandId,
        type: "content",
        input: { kind: "video_storyboard", ...data, businessContext },
      }),
    );
    await transact((db) => startAiJob(db, job.id));
    try {
      const response = await openRouterChat({
        messages: [
          {
            role: "system",
            content: `Rövid marketingvideó feliratait írod, a márka nyelvén. A poszt és a márka adataiból dolgozz, ne találj ki ajánlatot, árat vagy képen látható részletet. Egy képhez egy tömör, legfeljebb 160 karakteres feliratot adj. Az első legyen hook, az utolsó CTA; egyetlen képnél mindkettő szerepeljen. Nincs narráció. Kontextus:\n${businessContextPrompt(businessContext)}\nAI szabályok: ${profile.aiGuardrails}\nPéldák: ${profile.approvedExamples}\nKampány: ${JSON.stringify(campaign ? { objective: campaign.objective, offer: campaign.offer, cta: campaign.cta } : null)}`,
          },
          {
            role: "user",
            content: JSON.stringify({
              postTitle: post.title,
              editedPostContent: data.content,
              imageCount: data.imageIds.length,
            }),
          },
        ],
        schemaName: "photo_video_storyboard",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["scenes"],
          properties: {
            scenes: {
              type: "array",
              minItems: data.imageIds.length,
              maxItems: data.imageIds.length,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["caption", "duration"],
                properties: {
                  caption: { type: "string" },
                  duration: { type: "integer", minimum: 3, maximum: 8 },
                },
              },
            },
          },
        },
      });
      if (!response.ok)
        throw new Error(
          response.status === 402
            ? "Nincs elegendő AI kredit a videófeliratokhoz. A képeidből kézzel megadott feliratokkal is készíthetsz videót."
            : `A videófeliratok AI szolgáltatása nem válaszolt megfelelően (${response.status}).`,
        );
      const result = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = result.choices?.[0]?.message?.content;
      if (!raw) throw new Error("Az AI üres videótervet adott. Próbáld újra.");
      const parsed = z
        .object({
          scenes: z
            .array(
              z.object({
                caption: z.string().trim().min(1).max(160),
                duration: z.number().int().min(3).max(8),
              }),
            )
            .length(data.imageIds.length),
        })
        .safeParse(JSON.parse(raw));
      if (!parsed.success) throw new Error("Az AI videóterve hiányos. Próbáld újra.");
      const scenes = VideoScenesSchema.parse(
        parsed.data.scenes.map((scene, index) => ({
          ...scene,
          mediaAssetId: data.imageIds[index],
        })),
      );
      await transact((db) => {
        ownedVideoContext(db, context, post.id, data.imageIds);
        const current = db.aiJobs.find((item) => item.id === job.id);
        if (!current) throw new Error("A videóterv nem menthető.");
        current.input.scenes = scenes;
        completeAiJob(db, job.id);
      });
      return { scenes, format: data.format };
    } catch (cause) {
      const message =
        cause instanceof SyntaxError
          ? "Az AI hibás videótervet adott. Próbáld újra."
          : cause instanceof Error
            ? cause.message
            : "A videóterv nem készült el.";
      await transact((db) => completeAiJob(db, job.id, message));
      throw new Error(message);
    }
  });

export const createPostVideo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => RenderInput.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const imageIds = data.scenes.map((item) => item.mediaAssetId);
    const { post, brand, profile } = ownedVideoContext(
      await readData(),
      context,
      data.postId,
      imageIds,
    );
    const job = await transact((db) =>
      createAiJob(db, {
        workspaceId: post.workspaceId,
        brandId: brand.id,
        type: "content",
        input: { kind: "video_render", ...data },
      }),
    );
    let savedId: string | undefined;
    await transact((db) => startAiJob(db, job.id));
    try {
      const video = await renderPhotoVideo({
        ...data,
        brandName: brand.name,
        color: profile.colors.find((item) => /^#[a-f\d]{6}$/i.test(item)),
      });
      const id = newId("media");
      const asset: MediaAssetRecord = {
        id,
        workspaceId: post.workspaceId,
        brandId: brand.id,
        filename: `marketingpilot-video-${id.slice(-8)}.mp4`,
        mimeType: "video/mp4",
        size: video.size,
        width: video.width,
        height: video.height,
        path: id,
        altText: `${post.title} – saját képekből összeállított videó`,
        source: "import",
        createdAt: nowIso(),
      };
      savedId = id;
      await writeMediaFile(id, video.bytes);
      await transact((db) => {
        const current = ownedVideoContext(db, context, post.id, imageIds).post;
        db.mediaAssets.push(asset);
        current.mediaAssetIds = [...new Set([...current.mediaAssetIds, id])];
        current.updatedAt = nowIso();
        completeAiJob(db, job.id);
      });
      return { asset };
    } catch (cause) {
      if (savedId) await removeMediaFile(savedId).catch(() => undefined);
      const message = cause instanceof Error ? cause.message : "Nem sikerült elkészíteni a videót.";
      await transact((db) => completeAiJob(db, job.id, message));
      throw new Error(message);
    }
  });
