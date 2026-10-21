Warning: truncated output (original token count: 15462)
Total output lines: 1532

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  PostAbVariantRecord,
  PostAdCopyRecord,
  PostRecord,
  PostVariantRecord,
  PostPlatform,
} from "@/lib/data-model";
import { requireAuthContext, requireBrandContext } from "@/lib/server/auth-context.server";
import {
  completeAiJob,
  createAiJob,
  newId,
  nowIso,
  startAiJob,
  transact,
  readData,
} from "@/lib/server/store.server";
import { requestAiJson } from "@/lib/server/ai-json.server";
import { generateFactualPost } from "@/lib/server/post-content.server";
import { shouldSaveIdeaAsOfflineDraft, offlineIdeaVariants } from "@/lib/offline-post-draft";
import {
  FACTUAL_CONTENT_RULES,
  assertContentReady,
  contentPlaceholders,
  contentSoftClaimWarnings,
} from "@/lib/content-quality";
import { buildBusinessContext, businessContextPrompt } from "@/lib/business-types";
import { formatPostScheduleInput } from "@/lib/post-schedule";
import { marketWritingRules } from "@/i18n/prompts/hu-RO";
import { MainChannelSchema } from "./main-channel";
import { channelSwitchSource, commitChannelSwitch, restoreChannelText } from "./server/post-channel.server";
import { postCopyText } from "./post-editor";
import {
  generateOpeningOptions,
  generateQuestionClosings,
  generateSimilarPosts,
  improveCopy,
} from "./server/post-quick-actions.server";

const platforms = [
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
  "youtube",
  "google-business",
] as const;
const statuses = ["idea", "draft", "review", "scheduled", "published", "failed"] as const;
const PlatformSchema = z.enum(platforms);
const StatusSchema = z.enum(statuses);
const VariantInputSchema = z.object({
  verificationWarnings: z.array(z.string().max(500)).max(20).optional(),
  id: z.string().optional(),
  platform: PlatformSchema,
  content: z.string().max(30000),
  hashtags: z.array(z.string().max(80)).max(40).default([]),
  cta: z.string().max(1000).default(""),
  status: z.enum(["draft", "review", "prepared", "published", "failed"]).default("draft"),
});
const AbVariantInputSchema = z.object({
  id: z.string().optional(),
  platform: PlatformSchema,
  label: z.string().trim().max(120),
  content: z.string().max(30000),
  hashtags: z.array(z.string().max(80)).max(40).default([]),
  cta: z.string().max(1000).default(""),
  selected: z.boolean().default(false),
});
const AdCopyInputSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().max(120),
  primaryText: z.string().max(12000),
  headline: z.string().max(500),
  description: z.string().max(2000),
  cta: z.string().max(300).default(""),
});
const ScheduledAtSchema = z.string().datetime({ offset: true }).nullable().optional().default(null);
const PostFieldsSchema = z.object({
  title: z.string().trim().min(1).max(240),
  goal: z.string().trim().max(120).default(""),
  audience: z.string().trim().max(4000).default(""),
  language: z.string().trim().max(120).default("magyar"),
  tone: z.string().trim().max(160).default("Barátságos"),
  status: StatusSchema.default("draft"),
  scheduledAt: ScheduledAtSchema,
  timezone: z.string().trim().max(100).default("Europe/Bucharest"),
  mediaAssetIds: z.array(z.string()).max(20).default([]),
  platforms: z.array(PlatformSchema).max(6).default([]),
  campaignId: z.string().nullable().optional().default(null),
});

export type PostSnapshot = {
  post: PostRecord;
  variants: PostVariantRecord[];
  versions: ReturnType<typeof snapshotVersions>;
  media: ReturnType<typeof snapshotMedia>;
  hooks: string[];
  abVariants: PostAbVariantRecord[];
  adCopies: PostAdCopyRecord[];
};
function snapshotVersions(database: Awaited<ReturnType<typeof readData>>, postId: string) {
  return database.postVersions.filter((item) => item.postId === postId);
}
function snapshotMedia(database: Awaited<ReturnType<typeof readData>>, post: PostRecord) {
  return database.mediaAssets.filter(
    (item) =>
      item.workspaceId === post.workspaceId &&
      item.brandId === post.brandId &&
      post.mediaAssetIds.includes(item.id),
  );
}
async function getPostSnapshot(
  postId: string,
  userId: string,
  workspaceId: string,
): Promise<PostSnapshot | null> {
  const database = await readData();
  const membership = database.memberships.find(
    (item) => item.userId === userId && item.workspaceId === workspaceId,
  );
  const post = database.posts.find(
    (item) => item.id === postId && item.workspaceId === workspaceId,
  );
  if (
    !membership ||
    !post ||
    !database.brands.some((item) => item.id === post.brandId && item.workspaceId === workspaceId)
  )
    return null;
  return {
    post,
    variants: database.postVariants.filter((item) => item.postId === post.id),
    versions: snapshotVersions(database, post.id),
    media: snapshotMedia(database, post),
    hooks: post.hooks ?? [],
    abVariants: post.abVariants ?? [],
    adCopies: post.adCopies ?? [],
  };
}

export const getPosts = createServerFn({ method: "GET" }).handler(async () => {
  const context = await requireAuthContext();
  const database = await readData();
  return database.posts
    .filter(
      (post) =>
        post.workspaceId === context.workspace.id &&
        context.brands.some((brand) => brand.id === post.brandId),
    )
    .map((post) => ({
      ...post,
      brandName:
        context.brands.find((brand) => brand.id === post.brandId)?.name ?? "Ismeretlen márka",
      variants: database.postVariants.filter((variant) => variant.postId === post.id),
      media: snapshotMedia(database, post),
    }));
});

export const getPost = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ postId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const snapshot = await getPostSnapshot(data.postId, context.user.id, context.workspace.id);
    if (!snapshot) throw new Error("A poszt nem található ebben a munkatérben.");
    return snapshot;
  });

export const createPostDraft = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    PostFieldsSchema.extend({ brandId: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const brandId = data.brandId ?? context.activeBrand?.id;
    if (!brandId || !context.brands.some((brand) => brand.id === brandId))
      throw new Error("Aktív, elérhető márka szükséges.");
    if (data.status === "published")
      throw new Error("A közzétételt a „Közzétettem” gombbal jelölheted.");
    if (data.status === "scheduled")
      throw new Error("Előbb készíts és ments posztszöveget, majd ütemezd.");
    const post = await transact((database) => {
      const ownedMedia = database.mediaAssets.filter(
        (asset) =>
          asset.workspaceId === context.workspace.id &&
          asset.brandId === brandId &&
          data.mediaAssetIds.includes(asset.id),
      );
      if (ownedMedia.length !== data.mediaAssetIds.length)
        throw new Error("A médiafájl nem ehhez a márkához tartozik.");
      if (
        data.campaignId &&
        !database.campaigns.some(
          (campaign) =>
            campaign.id === data.campaignId &&
            campaign.workspaceId === context.workspace.id &&
            campaign.brandId === brandId,
        )
      )
        throw new Error("A kampány nem ehhez a márkához tartozik.");
      const timestamp = nowIso();
      const created: PostRecord = {
        ...data,
        id: newId("post"),
        workspaceId: context.workspace.id,
        brandId,
        campaignId: data.campaignId,
        title: data.title,
        goal: data.goal,
        audience: data.audience,
        language: data.language,
        tone: data.tone,
        status: data.status,
        scheduledAt: data.scheduledAt,
        timezone: data.timezone,
        mediaAssetIds: data.mediaAssetIds,
        platforms: data.platforms,
        hooks: [],
        selectedHook: null,
        abVariants: [],
        adCopies: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      database.posts.push(created);
      return created;
    });
    return getPostSnapshot(post.id, context.user.id, context.workspace.id);
  });

const UpdateSchema = z.object({
  postId: z.string().min(1),
  expectedPostUpdatedAt: z.string().datetime().optional(),
  fields: PostFieldsSchema.partial(),
  variants: z.array(VariantInputSchema).optional(),
  hooks: z.array(z.string().trim().min(2).max(1000)).max(20).optional(),
  selectedHook: z.string().max(1000).nullable().optional(),
  abVariants: z.array(AbVariantInputSchema).max(20).optional(),
  adCopies: z.array(AdCopyInputSchema).max(12).optional(),
  createVersion: z.boolean().default(true),
});
export const updatePost = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => UpdateSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const result = await transact((database) => {
      const post = database.posts.find(
        (item) => item.id === data.postId && item.workspaceId === context.workspace.id,
      );
      if (!post || !context.brands.some((brand) => brand.id === post.brandId))
        throw new Error("Nincs hozzáférés ehhez a poszthoz.");
      if (data.expectedPostUpdatedAt && post.updatedAt !== data.expectedPostUpdatedAt)
        throw new Error("A poszt közben máshol megváltozott. Nem írtuk felül; nyisd meg újra, majd illeszd be a szerkesztett szövegedet.");
      // A stale editor cannot erase a saved manual-publication marker.
      for (const variant of data.variants ?? []) {
        if (database.postVariants.some((saved) => saved.id === variant.id && saved.postId === post.id && saved.status === "published")) variant.status = "published";
      }
      if (data.fields.status === "published" && post.status !== "published")
        throw new Error("A közzétételt a „Közzétettem” gombbal jelölheted.");
      if (data.variants?.some((variant) => variant.status === "published" && !database.postVariants.some((saved) => saved.id === variant.id && saved.postId === post.id && saved.status === "published")))
        throw new Error("A közzétételt a „Közzétettem” gombbal jelölheted.");
      for (const variant of data.variants ?? [])
        if (variant.status === "prepared" || variant.status === "published")
          assertContentReady(variant.content, variant.cta, ...variant.hashtags);
      const scheduledAt =
        data.fields.scheduledAt !== undefined ? data.fields.scheduledAt : post.scheduledAt;
      const finalStatus = data.fields.status ?? post.status;
      if (finalStatus === "scheduled" && !scheduledAt)
        throw new Error("Az ütemezett poszthoz időpont szükséges.");
      if (finalStatus === "scheduled") {
        const variants =
          data.variants ?? database.postVariants.filter((item) => item.postId === post.id);
        const selected = data.fields.platforms ?? post.platforms ?? [];
        const scheduledVariants = variants.filter(
          (item) => !selected.length || selected.includes(item.platform),
        );
        if (
          !scheduledVariants.length ||
          scheduledVariants.some((item) => !item.content.trim()) ||
          selected.some(
            (platform) => !scheduledVariants.some((variant) => variant.platform === platform),
          )
        )
          throw new Error("Az ütemezéshez előbb készíts posztszöveget.");
        assertContentReady(
          ...scheduledVariants.flatMap((item) => [item.content, item.cta, ...item.hashtags]),
        );
      }
      const mediaIds = data.fields.mediaAssetIds;
      if (mediaIds) {
        const owned = database.mediaAssets.filter(
          (asset) =>
            asset.workspaceId === post.workspaceId &&
            asset.brandId === post.brandId &&
            mediaIds.includes(asset.id),
        );
        if (owned.length !== mediaIds.length)
          throw new Error("A médiafájl nem ehhez a márkához tartozik.");
      }
      if (
        data.fields.campaignId &&
        !database.campaigns.some(
          (campaign) =>
            campaign.id === data.fields.campaignId &&
            campaign.workspaceId === post.workspaceId &&
            campaign.brandId === post.brandId,
        )
      )
        throw new Error("A kampány nem ehhez a márkához tartozik.");
      const timestamp = nowIso();
      Object.assign(post, data.fields, { updatedAt: timestamp });
      if (data.hooks !== undefined) post.hooks = data.hooks;
      if (data.selectedHook !== undefined) post.selectedHook = data.selectedHook;
      if (data.abVariants !== undefined)
        post.abVariants = data.abVariants.map((item) => ({
          ...item,
          id: item.id ?? newId("ab"),
          postId: post.id,
          createdAt: timestamp,
          updatedAt: timestamp,
        })) as PostAbVariantRecord[];
      if (data.adCopies !== undefined)
        post.adCopies = data.adCopies.map((item) => ({
          ...item,
          id: item.id ?? newId("ad"),
          postId: post.id,
          createdAt: timestamp,
          updatedAt: timestamp,
        })) as PostAdCopyRecord[];
      if (data.fields.campaignId !== undefined)
        for (const planItem of database.planItems)
          if (
            planItem.postId === post.id &&
            planItem.workspaceId === post.workspaceId &&
            planItem.brandId === post.brandId
          ) {
            planItem.campaignId = data.fields.campaignId ?? null;
            planItem.updatedAt = timestamp;
          }
      if (scheduledAt) {
        const zone = post.timezone || "Europe/Bucharest";
        const local = formatPostScheduleInput(scheduledAt, zone);
        if (!local) throw new Error("Az ütemezett időpont vagy időzóna érvénytelen.");
        for (const planItem of database.planItems)
          if (
            planItem.postId === post.id &&
            planItem.workspaceId === post.workspaceId &&
            planItem.brandId === post.brandId &&
            planItem.status !== "skipped" && planItem.status !== "published"
          ) {
            planItem.date = local.slice(0, 10);
            planItem.time = local.slice(11, 16);
            planItem.timezone = zone;
            planItem.updatedAt = timestamp;
          }
      }
      const linkedPlanStatus =
        post.status === "idea"
          ? "idea"
          : post.status === "review"
            ? "ready"
            : post.status === "scheduled"
              ? "scheduled"
              : post.status === "published"
                ? "published"
                : "draft";
      for (const planItem of database.planItems) {
        if (
          planItem.postId === post.id &&
          planItem.workspaceId === post.workspaceId &&
          planItem.brandId === post.brandId &&
          planItem.status !== "skipped"
        ) {
          const variant = data.variants?.find((v) => v.platform === planItem.platform) ?? database.postVariants.find((v) => v.postId === post.id && v.platform === planItem.platform);
          planItem.status = variant?.status === "published" ? "published" : linkedPlanStatus;
          planItem.updatedAt = timestamp;
        }
      }
      if (data.variants)
        for (const input of data.variants) {
          const existing = input.id
            ? database.postVariants.find((item) => item.id === input.id && item.postId === post.id)
            : undefined;
          if (input.id && !existing)
            throw new Error("Nincs hozzáférés ehhez a platformváltozathoz.");
          if (existing) {
            if (data.createVersion && existing.content !== input.content)
              database.postVersions.push({
                id: newId("version"),
                postId: post.id,
                variantId: existing.id,
                content: existing.content,
                createdAt: timestamp,
                createdBy: context.user.id,
              });
            Object.assign(existing, input, { updatedAt: timestamp, postId: post.id });
          } else
            database.postVariants.push({
              id: newId("variant"),
              postId: post.id,
              platform: input.platform,
              verificationWarnings: input.verificationWarnings ?? [],
              content: input.content,
              hashtags: input.hashtags,
              cta: input.cta,
              status: input.status,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
        }
      if (finalStatus === "scheduled" && scheduledAt) {
        const selected = new Set(post.platforms ?? []);
        const variants = database.postVariants.filter(
          (variant) =>
            variant.postId === post.id &&
            variant.status !== "published" &&
            variant.content.trim() &&
            (!selected.size || selected.has(variant.platform)),
        );
        const zone = post.timezone || "Europe/Bucharest";
        const local = formatPostScheduleInput(scheduledAt, zone);
        if (!local) throw new Error("Az ütemezett időpont vagy időzóna érvénytelen.");
        for (const variant of variants) {
          const linked = database.planItems.some(
            (item) =>
              item.postId === post.id &&
              item.platform === variant.platform &&
              item.workspaceId === post.workspaceId &&
              item.brandId === post.brandId,
          );
          if (!linked)
            database.planItems.push({
              id: newId("plan"),
              workspaceId: post.workspaceId,
              brandId: post.brandId,
              campaignId: post.campaignId ?? null,
              postId: post.id,
              date: local.slice(0, 10),
              time: local.slice(11, 16),
              timezone: zone,
              platform: variant.platform,
              contentType: "social",
              topic: post.title,
              objective: post.goal,
              status: "scheduled",
              aiGenerated: false,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
        }
      }
      return post.id;
    });
    return getPostSnapshot(result, context.user.id, context.workspace.id);
  });

export const deletePost = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ postId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    await transact((database) => {
      const post = database.posts.find(
        (item) => item.id === data.postId && item.workspaceId === context.workspace.id,
      );
      if (!post || !context.brands.some((brand) => brand.id === post.brandId))
        throw new Error("Nincs hozzáférés ehhez a poszthoz.");
      const timestamp = nowIso();
      for (const planItem of database.planItems)
        if (planItem.postId === post.id && planItem.workspaceId === post.workspaceId) {
          planItem.postId = null;
          if (planItem.status !== "skipped") planItem.status = "planned";
          planItem.updatedAt = timestamp;
        }
      database.posts = database.posts.filter(
        (item) =>
          !(
            item.id === post.id &&
            item.workspaceId === post.workspaceId &&
            item.brandId === post.brandId
          ),
      );
      database.postVariants = database.postVariants.filter((item) => item.postId !== post.id);
      database.postVersions = database.postVersions.filter((item) => item.postId !== post.id);
    });
    return { ok: true };
  });

export const copyPost = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ postId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const source = await getPostSnapshot(data.postId, context.user.id, context.workspace.id);
    if (!source) throw new Error("Nincs hozzáférés ehhez a poszthoz.");
    const created = await transact((database) => {
      const timestamp = nowIso();
      const post: PostRecord = {
        ...source.post,
        id: newId("post"),
        title: `${source.post.title} (másolat)`,
        status: "draft",
        scheduledAt: null,
        mediaAssetIds: [...source.post.mediaAssetIds],
        hooks: [...source.hooks],
        selectedHook: source.post.selectedHook ?? null,
        abVariants: [],
        adCopies: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      database.posts.push(post);
      for (const variant of source.variants)
        database.postVariants.push({
          ...variant,
          id: newId("variant"),
          postId: post.id,
          status: "draft",
          manualPublishedAt: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      post.abVariants = source.abVariants.map((item) => ({
        ...item,
        id: newId("ab"),
        postId: post.id,
        selected: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));
      post.adCopies = source.adCopies.map((item) => ({
        ...item,
        id: newId("ad"),
        postId: post.id,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));
      return post.id;
    });
    return getPostSnapshot(created, context.user.id, context.workspace.id);
  });

export const markPostManuallyPublished = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ postId: z.string().min(1), variantId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const { markManualPublication } = await import("./server/manual-publication.server");
    await transact((db) => markManualPublication(db, context, data.postId, data.variantId));
    return getPostSnapshot(data.postId, context.user.id, context.workspace.id);
  });

const GenerateSchema = z.object({
  postId: z.string().min(1).optional(),
  title: z.string().trim().min(1).max(240),
  goal: z.string().trim().max(120),
  audience: z.string().trim().max(4000),
  topic: z.string().trim().min(2).max(4000),
  region: z.string().trim().max(160),
  language: z.string().trim().max(120),
  tone: z.string().trim().max(160),
  ctaStyle: z.string().trim().max(240),
  platforms: z.array(PlatformSchema).min(1).max(6),
  campaignContext: z.string().max(2000).optional(),
});
export const generatePostVariants = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => GenerateSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await requireBrandContext();
    const brand = context.activeBrand;
    if (!brand) throw new Error("Még nincs aktív márka ebben a munkatérben.");
    const voice = brand.profile;
    const businessContext = buildBusinessContext(brand, voice, {
      goal: data.goal,
      audience: data.audience || brand.audience,
      region: data.region || brand.cityRegion,
      language: data.language || brand.languageMarket,
      platform: data.platforms.join(", "),
    });
    if (data.tone.trim()) businessContext.tone = data.tone.trim();
    const job = await transact((database) =>
      createAiJob(database, {
        workspaceId: context.workspace.id,
        brandId: brand.id,
        type: "content",
        input: { ...data, businessContext },
      }),
    );
    await transact((database) => startAiJob(database, job.id));
    try {
      const parsed = await generateFactualPost({
        businessContext,
        brief: data.topic,
        title: data.title,
        platforms: data.platforms,
        ctaStyle: data.ctaStyle || voice.ctaStyle,
        campaignContext: data.campaignContext,
      });
      const variants = parsed.variants;
      const postId = await transact((database) => {
        const timestamp = nowIso();
        const existing = data.postId
          ? database.posts.find(
              (item) =>
                item.id === data.postId &&
                item.workspaceId === context.workspace.id &&
                item.brandId === brand.id,
            )
          : undefined;
        if (data.postId && !existing) throw new Error("Nincs hozzáférés ehhez a poszthoz.");
        const post: PostRecord = existing ?? {
          id: newId("post"),
          workspaceId: context.workspace.id,
          brandId: brand.id,
          campaignId: null,
          title: data.title,
          goal: data.goal,
          audience: data.audience || brand.audience,
          language: data.language || brand.languageMarket,
          tone: data.tone || voice.tone,
          status: "draft",
          scheduledAt: null,
          timezone: "Europe/Bucharest",
          mediaAssetIds: [],
          platforms: data.platforms,
          hooks: [],
          selectedHook: null,
          abVariants: [],
          adCopies: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        Object.assign(post, {
          title: data.title,
          goal: data.goal,
          audience: data.audience || brand.audience,
          language: data.language || brand.languageMarket,
          tone: data.tone || voice.tone,
          platforms: data.platforms,
          status: "draft",
          updatedAt: timestamp,
        });
        if (!existing) database.posts.push(post);
        database.postVariants = database.postVariants.filter((item) => item.postId !== post.id);
        for (const item of variants)
          database.postVariants.push({
            id: newId("variant"),
            postId: post.id,
            platform: item.platform,
            verificationWarnings: item.ellenorizendo,
            content: item.content,
            hashtags: item.hashtags ?? [],
            cta: item.cta ?? "",
            status: contentPlaceholders(item.content, item.cta, ...item.hashtags).length
              ? "draft"
              : "prepared",
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        return post.id;
      });
      await transact((database) => completeAiJob(database, job.id));
      return getPostSnapshot(postId, context.user.id, context.workspace.id);
    } catch (cause) {
      if (shouldSaveIdeaAsOfflineDraft(cause, data.postId)) {
        try {
          const fallbackPostId = await transact((database) => {
            const timestamp = nowIso();
            const post: PostRecord = {
              id: newId("post"),
              workspaceId: context.workspace.id,
              brandId: brand.id,
              campaignId: null,
              title: data.title,
              goal: data.goal,
              audience: data.audience || brand.audience,
              language: data.language || brand.languageMarket,
              tone: data.tone || voice.tone,
              status: "draft",
              scheduledAt: null,
              timezone: "Europe/Bucharest",
              mediaAssetIds: [],
              platforms: data.platforms,
              hooks: [],
              selectedHook: null,
              abVariants: [],
              adCopies: [],
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            database.posts.push(post);
            for (const item of offlineIdeaVariants(data.topic, data.platforms))
              database.postVariants.push({
                id: newId("variant"),
                postId: post.id,
                platform: item.platform as PostPlatform,
                verificationWarnings: item.ellenorizendo,
                content: item.content,
                hashtags: item.hashtags,
                cta: item.cta,
                status: "draft",
                createdAt: timestamp,
                updatedAt: timestamp,
              });
            return post.id;
          });
          await transact((database) => completeAiJob(database, job.id, "AI_UNAVAILABLE_OFFLINE_DRAFT"));
          const snapshot = await getPostSnapshot(fallbackPostId, context.user.id, context.workspace.id);
          if (!snapshot) throw new Error("A piszkozat mentése nem sikerült.");
          return snapshot;
        } catch (fallbackError) {
          await transact((database) => completeAiJob(database, job.id, "OFFLINE_DRAFT_SAVE_FAILED"));
          throw fallbackError;
        }
      }
      await transact((database) =>
        completeAiJob(database, job.id, cause instanceof Error ? cause.message : "AI hiba"),
      );
      throw cause;
    }
  });

const ExtrasInputSchema = z.object({
  postId: z.string().min(1),
  platform: PlatformSchema.optional(),
  count: z.number().int().min(2).max(4).default(3),
});

export const switchPostChannel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    postId: z.string().min(1), variantId: z.string().min(1),
    channel: MainChannelSchema, expectedUpdatedAt: z.string().datetime(),
  }).strict().parse(data))
  .handler(async ({ data }) => {
    const { context, post, brand, database } = await ownedPostContext(data.postId);
    const scope = { userId: context.user.id, workspaceId: context.workspace.…462 tokens truncated…  }
  });

export const restorePostChannelText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    postId: z.string().min(1), versionId: z.string().min(1), expectedPostUpdatedAt: z.string().datetime(),
  }).strict().parse(data))
  .handler(async ({ data }) => {
    const { context, post } = await ownedPostContext(data.postId);
    const variantId = await transact((db) => restoreChannelText(db,
      { userId: context.user.id, workspaceId: context.workspace.id }, post.id, data.versionId, data.expectedPostUpdatedAt));
    return { variantId, snapshot: await getPostSnapshot(post.id, context.user.id, context.workspace.id) };
  });

// Rewrites the saved, owned text; never replaces other platform variants or publication history.
export const rewritePostVariant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ postId: z.string().min(1), variantId: z.string().min(1), style: z.enum(["alternative", "shorter", "friendlier"]) }).parse(data))
  .handler(async ({ data }) => {
    const { context, post, brand, database } = await ownedPostContext(data.postId);
    const source = database.postVariants.find((v) => v.id === data.variantId && v.postId === post.id);
    if (!source?.content.trim()) throw new Error("Előbb készíts posztszöveget.");
    if (source.status === "published") throw new Error("A közzétett posztról előbb készíts másolatot.");
    const job = await transact((db) => createAiJob(db, { workspaceId: post.workspaceId, brandId: post.brandId, type: "content", input: { kind: "post_rewrite", postId: post.id, style: data.style } }));
    await transact((db) => startAiJob(db, job.id));
    try {
      const businessContext = buildBusinessContext(brand, brand.profile, { goal: post.goal, audience: post.audience, language: post.language, platform: source.platform });
      const instruction = data.style === "shorter" ? "Írd át lényegesen rövidebbre, legfeljebb az eredeti hossz 75%-ára." : data.style === "friendlier" ? "Írd át közvetlenebb, barátságosabb hangon, a megadott megszólítást megtartva." : "Írj más megközelítésű változatot, más nyitással és felépítéssel.";
      const result = await generateFactualPost({ businessContext, title: post.title, platforms: [source.platform], ctaStyle: brand.profile.ctaStyle, brief: `${instruction} Kizárólag a mentett poszt és márka tényeit használd. A helykitöltők maradjanak meg, új tényt ne adj hozzá. Mentett poszt: ${source.content}\n${source.cta}\n${source.hashtags.join(' ')}` });
      const next = result.variants[0];
      await transact((db) => {
        const current = db.postVariants.find((v) => v.id === source.id && v.postId === post.id);
        const owned = db.posts.find((p) => p.id === post.id && p.workspaceId === context.workspace.id && p.brandId === brand.id);
        if (!current || !owned || current.content !== source.content || current.updatedAt !== source.updatedAt || current.status === "published") throw new Error("A poszt közben megváltozott. Nyisd meg újra, majd próbáld meg ismét.");
        const timestamp = nowIso();
        db.postVersions.push({ id: newId("version"), postId: post.id, variantId: current.id, content: current.content, createdAt: timestamp, createdBy: context.user.id });
        Object.assign(current, { content: next.content, cta: next.cta, hashtags: next.hashtags, verificationWarnings: next.ellenorizendo, status: contentPlaceholders(next.content, next.cta, ...next.hashtags).length ? "draft" : "prepared", updatedAt: timestamp });
        owned.updatedAt = timestamp;
        completeAiJob(db, job.id);
      });
      return getPostSnapshot(post.id, context.user.id, context.workspace.id);
    } catch (cause) {
      await transact((db) => completeAiJob(db, job.id, cause instanceof Error ? cause.message : "Nem sikerült az átírás."));
      throw cause;
    }
  });

export const generatePostOpeningOptions = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => QuickVariantInputSchema.strict().parse(data))
  .handler(async ({ data }) => {
    const owned = await ownedPostContext(data.postId);
    const variant = requireFreshOwnedVariant(data, owned);
    const jobId = await createQuickActionJob(owned.post.workspaceId, owned.brand.id, {
      kind: "post_opening_options",
      postId: owned.post.id,
      variantId: variant.id,
      platform: variant.platform,
    });
    try {
      const result = await generateOpeningOptions({
        businessContext: quickActionBusinessContext(owned.brand, owned.post, variant.platform),
        platform: variant.platform,
        sourceText: postCopyText(variant),
      });
      await finishQuickActionJob(jobId);
      return {
        ...result,
        expectedPostUpdatedAt: owned.post.updatedAt,
        expectedVariantUpdatedAt: variant.updatedAt,
      };
    } catch (cause) {
      await finishQuickActionJob(jobId, cause);
      throw cause;
    }
  });

export const generatePostQuestionClosings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => QuickVariantInputSchema.strict().parse(data))
  .handler(async ({ data }) => {
    const owned = await ownedPostContext(data.postId);
    const variant = requireFreshOwnedVariant(data, owned);
    const jobId = await createQuickActionJob(owned.post.workspaceId, owned.brand.id, {
      kind: "post_question_closings",
      postId: owned.post.id,
      variantId: variant.id,
      platform: variant.platform,
    });
    try {
      const result = await generateQuestionClosings({
        businessContext: quickActionBusinessContext(owned.brand, owned.post, variant.platform),
        platform: variant.platform,
        sourceText: postCopyText(variant),
      });
      await finishQuickActionJob(jobId);
      return {
        ...result,
        expectedPostUpdatedAt: owned.post.updatedAt,
        expectedVariantUpdatedAt: variant.updatedAt,
      };
    } catch (cause) {
      await finishQuickActionJob(jobId, cause);
      throw cause;
    }
  });

const ImproveTextSchema = z.object({ text: z.string().trim().min(10).max(10000) }).strict();
export const improveExistingText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ImproveTextSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await requireBrandContext();
    const brand = context.activeBrand;
    if (!brand) throw new Error("Még nincs aktív vállalkozásod.");
    const platform = brand.profile.mainChannel ?? "facebook";
    const businessContext = buildBusinessContext(brand, brand.profile, {
      goal: "A megadott szöveg javítása",
      audience: brand.audience,
      language: brand.languageMarket,
      platform,
    });
    const jobId = await createQuickActionJob(context.workspace.id, brand.id, {
      kind: "improve_user_copy",
      inputLength: data.text.length,
      platform,
    });
    try {
      const result = await improveCopy({ businessContext, platform, sourceText: data.text });
      const postId = await transact((database) => {
        const timestamp = nowIso();
        const title = data.text.split(/\r?\n/u).find((line) => line.trim())?.trim().slice(0, 120) || "Saját szöveg javítása";
        const post: PostRecord = {
          id: newId("post"),
          workspaceId: context.workspace.id,
          brandId: brand.id,
          campaignId: null,
          title,
          goal: "Saját szöveg javítása",
          audience: brand.audience,
          language: brand.languageMarket,
          tone: brand.profile.tone,
          status: "draft",
          scheduledAt: null,
          timezone: "Europe/Bucharest",
          mediaAssetIds: [],
          platforms: [platform],
          hooks: [],
          selectedHook: null,
          abVariants: [],
          adCopies: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const variant = checkedVariantValues(
          brand,
          post,
          platform,
          result.content,
          result.cta,
          result.hashtags,
        );
        database.posts.push(post);
        database.postVariants.push({
          id: newId("variant"),
          postId: post.id,
          platform,
          ...variant,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
        return post.id;
      });
      await finishQuickActionJob(jobId);
      const snapshot = await getPostSnapshot(postId, context.user.id, context.workspace.id);
      if (!snapshot) throw new Error("A javított poszt mentése nem sikerült.");
      return { snapshot, reasons: result.reasons };
    } catch (cause) {
      await finishQuickActionJob(jobId, cause);
      throw cause;
    }
  });

async function persistSimilarPosts(input: {
  workspaceId: string;
  userId: string;
  brand: Awaited<ReturnType<typeof ownedPostContext>>["brand"];
  businessContext: ReturnType<typeof buildBusinessContext>;
  platform: PostPlatform;
  sourceText: string;
  goal: string;
  audience: string;
  language: string;
  tone: string;
}) {
  const generated = await generateSimilarPosts({
    businessContext: input.businessContext,
    platform: input.platform,
    sourceText: input.sourceText,
  });
  const ids = await transact((database) => {
    const timestamp = nowIso();
    return generated.posts.map((item) => {
      const post: PostRecord = {
        id: newId("post"),
        workspaceId: input.workspaceId,
        brandId: input.brand.id,
        campaignId: null,
        title: item.title,
        goal: input.goal || "Hasonló poszt",
        audience: input.audience || input.brand.audience,
        language: input.language || input.brand.languageMarket,
        tone: input.tone || input.brand.profile.tone,
        status: "draft",
        scheduledAt: null,
        timezone: "Europe/Bucharest",
        mediaAssetIds: [],
        platforms: [input.platform],
        hooks: [],
        selectedHook: null,
        abVariants: [],
        adCopies: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      database.posts.push(post);
      const variant = checkedVariantValues(
        input.brand,
        post,
        input.platform,
        item.content,
        item.cta,
        item.hashtags,
        item.ellenorizendo,
      );
      database.postVariants.push({
        id: newId("variant"),
        postId: post.id,
        platform: input.platform,
        ...variant,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return post.id;
    });
  });
  const snapshots = await Promise.all(ids.map((id) => getPostSnapshot(id, input.userId, input.workspaceId)));
  return snapshots.filter((snapshot): snapshot is PostSnapshot => snapshot !== null);
}

export const generateThreeSimilarPosts = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => QuickVariantInputSchema.strict().parse(data))
  .handler(async ({ data }) => {
    const owned = await ownedPostContext(data.postId);
    const variant = requireFreshOwnedVariant(data, owned);
    const businessContext = quickActionBusinessContext(owned.brand, owned.post, variant.platform);
    const jobId = await createQuickActionJob(owned.post.workspaceId, owned.brand.id, {
      kind: "similar_posts_from_saved",
      postId: owned.post.id,
      variantId: variant.id,
      platform: variant.platform,
    });
    try {
      const posts = await persistSimilarPosts({
        workspaceId: owned.context.workspace.id,
        userId: owned.context.user.id,
        brand: owned.brand,
        businessContext,
        platform: variant.platform,
        sourceText: postCopyText(variant),
        goal: owned.post.goal,
        audience: owned.post.audience,
        language: owned.post.language,
        tone: owned.post.tone,
      });
      if (posts.length !== 3) throw new Error("A három új poszt mentése nem sikerült.");
      await finishQuickActionJob(jobId);
      return { posts };
    } catch (cause) {
      await finishQuickActionJob(jobId, cause);
      throw cause;
    }
  });

const SimilarTextSchema = z.object({ text: z.string().trim().min(10).max(10000) }).strict();
export const generateSimilarPostsFromText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => SimilarTextSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await requireBrandContext();
    const brand = context.activeBrand;
    if (!brand) throw new Error("Még nincs aktív vállalkozásod.");
    const platform = brand.profile.mainChannel ?? "facebook";
    const businessContext = buildBusinessContext(brand, brand.profile, {
      goal: "Hasonló posztok készítése",
      audience: brand.audience,
      language: brand.languageMarket,
      platform,
    });
    const jobId = await createQuickActionJob(context.workspace.id, brand.id, {
      kind: "similar_posts_from_text",
      inputLength: data.text.length,
      platform,
    });
    try {
      const posts = await persistSimilarPosts({
        workspaceId: context.workspace.id,
        userId: context.user.id,
        brand,
        businessContext,
        platform,
        sourceText: data.text,
        goal: "A megadott mintához hasonló poszt",
        audience: brand.audience,
        language: brand.languageMarket,
        tone: brand.profile.tone,
      });
      if (posts.length !== 3) throw new Error("A három új poszt mentése nem sikerült.");
      await finishQuickActionJob(jobId);
      return { posts };
    } catch (cause) {
      await finishQuickActionJob(jobId, cause);
      throw cause;
    }
  });
const HooksResultSchema = z.object({
  hooks: z.array(z.string().trim().min(2).max(1000)).min(2).max(8),
});
const AbResultSchema = z.object({
  variants: z
    .array(
      z.object({
        label: z.string().max(120),
        content: z.string().max(30000),
        hashtags: z.array(z.string().max(80)).max(40).default([]),
        cta: z.string().max(1000).default(""),
      }),
    )
    .min(2)
    .max(4),
});
const AdResultSchema = z.object({
  variants: z
    .array(
      z.object({
        label: z.string().max(120),
        primaryText: z.string().max(12000),
        headline: z.string().max(500),
        description: z.string().max(2000),
        cta: z.string().max(300),
      }),
    )
    .min(1)
    .max(4),
});

const HOOK_RESULT = {
  type: "object",
  additionalProperties: false,
  required: ["hooks"],
  properties: { hooks: { type: "array", minItems: 2, maxItems: 8, items: { type: "string" } } },
} as const;
const AB_RESULT = {
  type: "object",
  additionalProperties: false,
  required: ["variants"],
  properties: {
    variants: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "content", "hashtags", "cta"],
        properties: {
          label: { type: "string" },
          content: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          cta: { type: "string" },
        },
      },
    },
  },
} as const;
const AD_RESULT = {
  type: "object",
  additionalProperties: false,
  required: ["variants"],
  properties: {
    variants: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "primaryText", "headline", "description", "cta"],
        properties: {
          label: { type: "string" },
          primaryText: { type: "string" },
          headline: { type: "string" },
          description: { type: "string" },
          cta: { type: "string" },
        },
      },
    },
  },
} as const;

async function ownedPostContext(postId: string) {
  const context = await requireAuthContext();
  const database = await readData();
  const post = database.posts.find(
    (candidate) =>
      candidate.id === postId &&
      candidate.workspaceId === context.workspace.id &&
      context.brands.some((brand) => brand.id === candidate.brandId),
  );
  if (!post) throw new Error("Nincs hozzáférés ehhez a poszthoz.");
  const brand = context.brands.find((candidate) => candidate.id === post.brandId);
  if (!brand) throw new Error("A poszt márkája nem található.");
  const campaign = post.campaignId
    ? database.campaigns.find(
        (candidate) =>
          candidate.id === post.campaignId &&
          candidate.workspaceId === context.workspace.id &&
          candidate.brandId === post.brandId,
      )
    : undefined;
  const baseVariant = database.postVariants.find(
    (candidate) => candidate.postId === post.id && (!post.campaignId || candidate.platform),
  );
  return { context, database, post, brand, campaign, baseVariant };
}

async function runJsonAi<T>(
  brandId: string,
  system: string,
  user: string,
  schemaName: string,
  schema: Record<string, unknown>,
  validate: z.ZodType<T>,
) {
  return requestAiJson(
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      schemaName,
      brandId,
      schema,
      maxTokens: 3500,
    },
    validate,
  );
}

async function createQuickActionJob(
  workspaceId: string,
  brandId: string,
  input: Record<string, unknown>,
) {
  const job = await transact((database) =>
    createAiJob(database, { workspaceId, brandId, type: "content", input }),
  );
  await transact((database) => startAiJob(database, job.id));
  return job.id;
}

async function finishQuickActionJob(jobId: string, cause?: unknown) {
  await transact((database) =>
    completeAiJob(
      database,
      jobId,
      cause instanceof Error ? cause.message : cause ? "A tartalom művelet nem sikerült." : undefined,
    ),
  );
}

function quickActionBusinessContext(
  brand: Awaited<ReturnType<typeof ownedPostContext>>["brand"],
  post: PostRecord,
  platform: string,
) {
  return buildBusinessContext(brand, brand.profile, {
    goal: post.goal,
    audience: post.audience || brand.audience,
    language: post.language || brand.languageMarket,
    platform,
  });
}

function checkedVariantValues(
  brand: Awaited<ReturnType<typeof ownedPostContext>>["brand"],
  post: PostRecord,
  platform: PostPlatform,
  content: string,
  cta: string,
  hashtags: string[],
  warnings: string[] = [],
) {
  const businessContext = quickActionBusinessContext(brand, post, platform);
  const facts = JSON.stringify({ ...businessContext, approvedClaims: brand.profile.approvedClaims });
  const claimContext = {
    businessType: businessContext.businessType,
    approvedClaims: businessContext.approvedClaims,
  };
  const softWarnings = contentSoftClaimWarnings(content, facts, claimContext);
  return {
    content,
    cta,
    hashtags,
    verificationWarnings: [...new Set([...warnings, ...softWarnings, ...contentPlaceholders(content, cta, ...hashtags)])],
    status: contentPlaceholders(content, cta, ...hashtags).length ? "draft" as const : "prepared" as const,
  };
}

const QuickVariantInputSchema = z.object({
  postId: z.string().min(1),
  variantId: z.string().min(1),
  expectedPostUpdatedAt: z.string().datetime(),
});

function requireFreshOwnedVariant(
  data: z.infer<typeof QuickVariantInputSchema>,
  owned: Awaited<ReturnType<typeof ownedPostContext>>,
) {
  const variant = owned.database.postVariants.find(
    (item) => item.id === data.variantId && item.postId === owned.post.id,
  );
  if (!variant) throw new Error("Nincs hozzáférés ehhez a posztváltozathoz.");
  if (owned.post.updatedAt !== data.expectedPostUpdatedAt)
    throw new Error("A poszt közben megváltozott. Frissítsd az oldalt, majd próbáld újra.");
  if (variant.status === "published") throw new Error("A közzétett posztból készíts másolatot a módosítás előtt.");
  return variant;
}

function extrasSystem(
  brand: Awaited<ReturnType<typeof ownedPostContext>>["brand"],
  post: PostRecord,
  platform?: string,
) {
  const businessContext = buildBusinessContext(brand, brand.profile, {
    goal: post.goal,
    audience: post.audience || brand.audience,
    platform,
  });
  return `A vállalkozás beállításában megadott nyelven dolgozó közösségimédia-szakember vagy. Használd ezt a strukturált üzleti kontextust:\n${businessContextPrompt(businessContext)}\n${marketWritingRules(businessContext.language)}\n${FACTUAL_CONTENT_RULES}`;
}

export const generatePostHooks = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ExtrasInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { context, post, brand, campaign } = await ownedPostContext(data.postId);
    const job = await transact((database) =>
      createAiJob(database, {
        workspaceId: context.workspace.id,
        brandId: brand.id,
        type: "content",
        input: {
          kind: "hooks",
          postId: post.id,
          count: data.count,
          topic: post.title,
          campaignId: campaign?.id ?? null,
        },
      }),
    );
    await transact((database) => startAiJob(database, job.id));
    try {
      const parsed = HooksResultSchema.parse(
        await runJsonAi(
          brand.id,
          `${extrasSystem(brand, post, post.platforms?.join(", "))} Adj ${data.count} egymástól jól eltérő, figyelemfelkeltő nyitómondatot (hookot) a poszthoz. Ez kizárólag nyitómondat: ne adj hozzá CTA-t, hashtageket vagy külön ellenőrzési mezőt; a megadott hook-sémát kövesd.`,
          `Poszt téma: ${post.title}\nCél: ${post.goal}\nKampány: ${campaign?.name ?? "nincs"}\nKampánycél: ${campaign?.objective ?? post.goal}`,
          "post_hooks",
          HOOK_RESULT,
          HooksResultSchema,
        ),
      );
      const hooks = [...new Set(parsed.hooks.map((hook) => hook.trim()).filter(Boolean))].slice(
        0,
        8,
      );
      await transact((database) => {
        const current = database.posts.find(
          (candidate) =>
            candidate.id === post.id &&
            candidate.workspaceId === context.workspace.id &&
            candidate.brandId === brand.id,
        );
        if (!current) throw new Error("A poszt időközben eltűnt.");
        current.hooks = hooks;
        current.selectedHook = hooks[0] ?? null;
        current.updatedAt = nowIso();
      });
      await transact((database) => completeAiJob(database, job.id));
      return { hooks };
    } catch (cause) {
      await transact((database) =>
        completeAiJob(
          database,
          job.id,
          cause instanceof Error ? cause.message : "Hook generálási hiba",
        ),
      );
      throw cause;
    }
  });

export const generatePostABVariants = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ExtrasInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { context, post, brand, campaign, database } = await ownedPostContext(data.postId);
    const platform =
      data.platform ?? database.postVariants.find((item) => item.postId === post.id)?.platform;
    if (!platform) throw new Error("Válassz legalább egy platformot az A/B változatokhoz.");
    const source = database.postVariants.find(
      (item) => item.postId === post.id && item.platform === platform,
    );
    const job = await transact((db) =>
      createAiJob(db, {
        workspaceId: context.workspace.id,
        brandId: brand.id,
        type: "content",
        input: {
          kind: "ab_variants",
          postId: post.id,
          platform,
          count: data.count,
          topic: post.title,
        },
      }),
    );
    await transact((db) => startAiJob(db, job.id));
    try {
      const parsed = AbResultSchema.parse(
        await runJsonAi(
          brand.id,
          `${extrasSystem(brand, post, platform)} Készíts ${data.count} valóban eltérő A/B megközelítést ugyanahhoz a ${platform} poszthoz. Legyen köztük például edukáló, érzelmi, ajánlatközpontú és közösségi megközelítés.`,
          `Téma: ${post.title}\nCél: ${post.goal}\nKiinduló szöveg: ${source?.content ?? "nincs"}\nKampány: ${campaign?.name ?? "nincs"}`,
          "post_ab_variants",
          AB_RESULT,
          AbResultSchema,
        ),
      );
      const timestamp = nowIso();
      const records: PostAbVariantRecord[] = parsed.variants.map((item, index) => ({
        id: newId("ab"),
        postId: post.id,
        platform,
        label: item.label || `A/B ${String.fromCharCode(65 + index)}`,
        content: item.content,
        hashtags: item.hashtags,
        cta: item.cta,
        selected: index === 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));
      await transact((db) => {
        const current = db.posts.find(
          (candidate) =>
            candidate.id === post.id &&
            candidate.workspaceId === context.workspace.id &&
            candidate.brandId === brand.id,
        );
        if (!current) throw new Error("A poszt időközben eltűnt.");
        current.abVariants = [
          ...(current.abVariants ?? []).filter((item) => item.platform !== platform),
          ...records,
        ];
        current.updatedAt = timestamp;
      });
      await transact((db) => completeAiJob(db, job.id));
      return { variants: records };
    } catch (cause) {
      await transact((db) =>
        completeAiJob(db, job.id, cause instanceof Error ? cause.message : "A/B generálási hiba"),
      );
      throw cause;
    }
  });

export const generatePostAdCopies = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ExtrasInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { context, post, brand, campaign } = await ownedPostContext(data.postId);
    const job = await transact((db) =>
      createAiJob(db, {
        workspaceId: context.workspace.id,
        brandId: brand.id,
        type: "content",
        input: {
          kind: "meta_ad_copy",
          postId: post.id,
          count: data.count,
          topic: post.title,
          campaignId: campaign?.id ?? null,
        },
      }),
    );
    await transact((db) => startAiJob(db, job.id));
    try {
      const parsed = AdResultSchema.parse(
        await runJsonAi(
          brand.id,
          `${extrasSystem(brand, post, post.platforms?.join(", "))} Meta hirdetésszöveg-specialista vagy. Készíts ${data.count} különböző hirdetési irányt. Mindegyikben legyen Primary Text, Headline, Description és egy rövid CTA.`,
          `Téma: ${post.title}\nCél: ${post.goal}\nKampánycél: ${campaign?.objective ?? ""}\nAjánlat: ${campaign?.offer ?? brand.offers}\nKampány CTA: ${campaign?.cta ?? brand.profile.ctaStyle}`,
          "meta_ad_copies",
          AD_RESULT,
          AdResultSchema,
        ),
      );
      const timestamp = nowIso();
      const records: PostAdCopyRecord[] = parsed.variants.map((item, index) => ({
        id: newId("ad"),
        postId: post.id,
        label: item.label || `Hirdetés ${index + 1}`,
        primaryText: item.primaryText,
        headline: item.headline,
        description: item.description,
        cta: item.cta,
        createdAt: timestamp,
        updatedAt: timestamp,
      }));
      await transact((db) => {
        const current = db.posts.find(
          (candidate) =>
            candidate.id === post.id &&
            candidate.workspaceId === context.workspace.id &&
            candidate.brandId === brand.id,
        );
        if (!current) throw new Error("A poszt időközben eltűnt.");
        current.adCopies = records;
        current.updatedAt = timestamp;
      });
      await transact((db) => completeAiJob(db, job.id));
      return { adCopies: records };
    } catch (cause) {
      await transact((db) =>
        completeAiJob(
          db,
          job.id,
          cause instanceof Error ? cause.message : "Hirdetésszöveg-generálási hiba",
        ),
      );
      throw cause;
    }
  });

export const updatePostMedia = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ postId: z.string().min(1), mediaAssetIds: z.array(z.string()).max(20) }).parse(data),
  )
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const result = await transact((database) => {
      const post = database.posts.find(
        (item) => item.id === data.postId && item.workspaceId === context.workspace.id,
      );
      if (!post || !context.brands.some((brand) => brand.id === post.brandId))
        throw new Error("Nincs hozzáférés ehhez a poszthoz.");
      const assets = database.mediaAssets.filter(
        (asset) =>
          asset.workspaceId === post.workspaceId &&
          asset.brandId === post.brandId &&
          data.mediaAssetIds.includes(asset.id),
      );
      if (assets.length !== data.mediaAssetIds.length)
        throw new Error("A médiafájl nem ehhez a márkához tartozik.");
      post.mediaAssetIds = data.mediaAssetIds;
      post.updatedAt = nowIso();
      return post.id;
    });
    return getPostSnapshot(result, context.user.id, context.workspace.id);
  });

