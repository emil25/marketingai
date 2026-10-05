import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildBusinessContext, businessContextPrompt } from "@/lib/business-types";
import {
  CREATIVE_FORMATS,
  CreativeDraftSchema,
  selectedCreativeIds,
  jpegSize,
  type CreativeDraft,
} from "@/lib/post-creative";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import { ownedCreativeContext } from "@/lib/server/creative-context.server";
import { openRouterChat } from "@/lib/server/ai-provider.server";
import {
  createAiJob,
  startAiJob,
  completeAiJob,
  readData,
  transact,
  newId,
  nowIso,
  writeMediaFile,
  removeMediaFile,
} from "@/lib/server/store.server";
import type { AppData, MediaAssetRecord, PostRecord } from "@/lib/data-model";

const PostInput = z.object({ postId: z.string().min(1).max(100) });
const DraftInput = PostInput.extend({ draft: CreativeDraftSchema });

export const getPostCreative = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => PostInput.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const db = await readData();
    const { post } = ownedCreativeContext(db, context, data.postId);
    const job = [...db.aiJobs]
      .reverse()
      .find(
        (item) =>
          item.workspaceId === post.workspaceId &&
          item.brandId === post.brandId &&
          item.status === "completed" &&
          item.input.postId === post.id &&
          ["creative_draft", "creative_render"].includes(String(item.input.kind)),
      );
    const draft = CreativeDraftSchema.safeParse(job?.input.draft);
    if (!draft.success) return null;
    // Keep editable text if a source photo has since been deleted.
    const available = new Set(
      db.mediaAssets
        .filter((asset) => asset.workspaceId === post.workspaceId && asset.brandId === post.brandId)
        .map((asset) => asset.id),
    );
    return {
      ...draft.data,
      slides: draft.data.slides.map((slide) => ({
        ...slide,
        imageId: slide.imageId && available.has(slide.imageId) ? slide.imageId : null,
      })),
    };
  });

function saveCaption(db: AppData, post: PostRecord, draft: CreativeDraft, userId: string) {
  let variant = db.postVariants.find(
    (item) => item.postId === post.id && item.platform === "instagram",
  );
  const timestamp = nowIso();
  if (variant && (variant.content !== draft.caption || variant.cta || variant.hashtags.length))
    db.postVersions.push({
      id: newId("version"),
      postId: post.id,
      variantId: variant.id,
      content: variant.content,
      createdAt: timestamp,
      createdBy: userId,
    });
  if (!variant) {
    variant = {
      id: newId("variant"),
      postId: post.id,
      platform: "instagram",
      content: "",
      hashtags: [],
      cta: "",
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    db.postVariants.push(variant);
  }
  Object.assign(variant, {
    content: draft.caption,
    hashtags: [],
    cta: "",
    status: draft.caption.trim() ? "prepared" : "draft",
    updatedAt: timestamp,
  });
  post.platforms = [...new Set([...(post.platforms ?? []), "instagram" as const])];
  post.updatedAt = timestamp;
}

export const savePostCreative = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => DraftInput.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    await transact((db) => {
      const { post } = ownedCreativeContext(db, context, data.postId, data.draft, true);
      saveCaption(db, post, data.draft, context.user.id);
      const job = createAiJob(db, {
        workspaceId: post.workspaceId,
        brandId: post.brandId,
        type: "content",
        input: { kind: "creative_draft", ...data },
      });
      startAiJob(db, job.id);
      completeAiJob(db, job.id);
    });
    return { draft: data.draft };
  });

export const generatePostCreative = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    DraftInput.extend({ content: z.string().trim().min(2).max(6000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const { post, brand, profile, campaign } = ownedCreativeContext(
      await readData(),
      context,
      data.postId,
      data.draft,
      true,
    );
    const businessContext = buildBusinessContext(brand, profile, {
      goal: post.goal,
      audience: post.audience || brand.audience,
      language: post.language,
      platform: "instagram",
    });
    const count = data.draft.slides.length;
    const job = await transact((db) =>
      createAiJob(db, {
        workspaceId: post.workspaceId,
        brandId: post.brandId,
        type: "content",
        input: { kind: "creative_generation", postId: post.id, businessContext, count },
      }),
    );
    await transact((db) => startAiJob(db, job.id));
    try {
      const response = await openRouterChat({
        schemaName: "instagram_creative",
        messages: [
          {
            role: "system",
            content: `Instagram képposztot vagy lapozható tartalmat tervezel. Pontosan ${count} lapot készíts, a márka nyelvén. Rövid, a képen olvasható címek és szövegek kellenek. Egy lap esetén ajánlat és CTA; több lap esetén hook → különböző hasznos tartalmi lapok → záró CTA. Ne ismételd ugyanazt minden lapon. Ne találj ki árakat, kedvezményeket, véleményeket vagy tényeket. Headline legfeljebb 100, body 260, CTA 70 karakter. Caption legfeljebb 2200 karakter, nem a lapok szövegének másolata. ${businessContextPrompt(businessContext)}\nBrand Voice: ${JSON.stringify({ tone: profile.tone, ctaStyle: profile.ctaStyle, approvedExamples: profile.approvedExamples, learnedSummary: profile.learnedSummary, aiGuardrails: profile.aiGuardrails })}\nKampány: ${JSON.stringify(campaign ? { objective: campaign.objective, audience: campaign.audience, offer: campaign.offer, cta: campaign.cta, strategy: campaign.strategy } : null)}`,
          },
          {
            role: "user",
            content: JSON.stringify({ title: post.title, editedContent: data.content, count }),
          },
        ],
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["slides", "caption"],
          properties: {
            slides: {
              type: "array",
              minItems: count,
              maxItems: count,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["headline", "body", "cta"],
                properties: {
                  headline: { type: "string" },
                  body: { type: "string" },
                  cta: { type: "string" },
                },
              },
            },
            caption: { type: "string" },
          },
        },
      });
      if (!response.ok)
        throw new Error(
          response.status === 402
            ? "Nincs elegendő AI kredit. A képfeliratokat kézzel is megadhatod."
            : `A kreatív szövegét az AI nem tudta elkészíteni (${response.status}).`,
        );
      const result = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = result.choices?.[0]?.message?.content;
      if (!raw) throw new Error("Az AI üres kreatívtervet adott. Próbáld újra.");
      const generated = z
        .object({
          slides: z
            .array(CreativeDraftSchema.shape.slides.element.omit({ imageId: true }))
            .length(count),
          caption: z.string().trim().min(1).max(2200),
        })
        .parse(JSON.parse(raw));
      const draft: CreativeDraft = {
        ...data.draft,
        caption: generated.caption,
        slides: generated.slides.map((slide, index) => ({
          ...slide,
          imageId: data.draft.slides[index].imageId,
        })),
      };
      await transact((db) => {
        ownedCreativeContext(db, context, post.id, draft, true);
        const current = db.aiJobs.find((item) => item.id === job.id);
        if (!current) throw new Error("A kreatívterv nem menthető.");
        current.input = { ...current.input, kind: "creative_draft", draft };
        completeAiJob(db, job.id);
      });
      return { draft };
    } catch (cause) {
      const message =
        cause instanceof SyntaxError || cause instanceof z.ZodError
          ? "Az AI hiányos vagy hibás kreatívtervet adott. Próbáld újra."
          : cause instanceof Error
            ? cause.message
            : "A kreatívterv nem készült el.";
      await transact((db) => completeAiJob(db, job.id, message));
      throw new Error(message);
    }
  });

export const saveRenderedCreative = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    DraftInput.extend({
      images: z
        .array(
          z
            .string()
            .max(2_800_000)
            .regex(/^[A-Za-z0-9+/]+={0,2}$/),
        )
        .min(1)
        .max(6),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const { post } = ownedCreativeContext(await readData(), context, data.postId, data.draft, true);
    if (data.images.length !== data.draft.slides.length)
      throw new Error("Minden laphoz egy elkészült kép szükséges.");
    const format = CREATIVE_FORMATS[data.draft.format];
    const images = data.images.map((image) => Buffer.from(image, "base64"));
    for (const bytes of images) {
      const dimensions = jpegSize(bytes);
      if (
        !dimensions ||
        dimensions.width !== format.width ||
        dimensions.height !== format.height ||
        bytes.length > 2 * 1024 * 1024 ||
        bytes.at(-2) !== 0xff ||
        bytes.at(-1) !== 0xd9
      )
        throw new Error("Érvénytelen kreatívkép. Készítsd el újra az előnézetből.");
    }
    const written: string[] = [];
    try {
      const assets: MediaAssetRecord[] = [];
      for (let index = 0; index < images.length; index++) {
        const id = newId("media");
        written.push(id);
        await writeMediaFile(id, images[index]);
        assets.push({
          id,
          workspaceId: post.workspaceId,
          brandId: post.brandId,
          filename: `marketingpilot-kreativ-${post.id.slice(-8)}-${index + 1}.jpg`,
          mimeType: "image/jpeg",
          size: images[index].length,
          width: format.width,
          height: format.height,
          path: id,
          altText: data.draft.slides[index].headline,
          source: "import",
          createdAt: nowIso(),
        });
      }
      const mediaAssetIds = await transact((db) => {
        const current = ownedCreativeContext(db, context, post.id, data.draft, true).post;
        const previousIds = selectedCreativeIds(db.aiJobs, current);
        db.mediaAssets.push(...assets);
        // Original photos and older exports stay in the library; this post selects the new creative images.
        current.mediaAssetIds = [
          ...assets.map((asset) => asset.id),
          ...current.mediaAssetIds.filter(
            (id) =>
              !previousIds.includes(id) &&
              !db.mediaAssets.some(
                (asset) => asset.id === id && asset.mimeType.startsWith("image/"),
              ),
          ),
        ];
        current.updatedAt = nowIso();
        saveCaption(db, current, data.draft, context.user.id);
        const job = createAiJob(db, {
          workspaceId: post.workspaceId,
          brandId: post.brandId,
          type: "content",
          input: {
            kind: "creative_render",
            postId: post.id,
            draft: data.draft,
            assetIds: assets.map((asset) => asset.id),
          },
        });
        startAiJob(db, job.id);
        completeAiJob(db, job.id);
        return current.mediaAssetIds;
      });
      return { assets, mediaAssetIds, caption: data.draft.caption };
    } catch (cause) {
      await Promise.all(written.map((id) => removeMediaFile(id).catch(() => undefined)));
      throw new Error(
        cause instanceof Error ? cause.message : "A képek mentése sikertelen. A posztod megmaradt.",
      );
    }
  });
