import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthContext } from "./server/auth-context.server";
import { useAppSession } from "./server/session.server";
import {
  completeAiJob,
  createAiJob,
  newId,
  nowIso,
  removeMediaFile,
  startAiJob,
  transact,
  getWorkspaceSnapshot,
} from "./server/store.server";
import { openRouterChat } from "./server/ai-provider.server";
import {
  BUSINESS_TYPES,
  buildBusinessContext,
  businessContextPrompt,
  normalizeBusinessType,
} from "@/lib/business-types";

const BrandInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(160),
  website: z.string().trim().max(500).optional().default(""),
  cityRegion: z.string().trim().max(160).optional().default(""),
  languageMarket: z.string().trim().max(120).optional().default("magyar"),
  industry: z.string().trim().max(160).optional().default(""),
  products: z.string().trim().max(4000).optional().default(""),
  services: z.string().trim().max(4000).optional().default(""),
  offers: z.string().trim().max(4000).optional().default(""),
  audience: z.string().trim().max(4000).optional().default(""),
});

const VoiceInputSchema = z.object({
  brandId: z.string().min(1),
  businessType: z.string().trim().optional().default("other"),
  address: z.string().trim().max(1000).optional(),
  openingHours: z.string().trim().max(1000).optional(),
  tone: z.string().trim().max(120).default("Barátságos"),
  ctaStyle: z.string().trim().max(240).default("Barátságos és közvetlen"),
  values: z.string().trim().max(4000).default(""),
  preferredPhrases: z.string().trim().max(4000).default(""),
  avoidedPhrases: z.string().trim().max(4000).default(""),
  description: z.string().trim().max(8000).default(""),
  approvedExamples: z.string().trim().max(8000).default(""),
  aiGuardrails: z.string().trim().max(8000).default(""),
  logoUrl: z.string().trim().max(1000).default(""),
  colors: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
  fontFamily: z.string().trim().max(120).default("Plus Jakarta Sans"),
  learningSamples: z.array(z.string().trim().min(20).max(12000)).max(20).optional(),
  learnedSummary: z.string().trim().max(12000).optional(),
  learnedAt: z.string().nullable().optional(),
});

const LearnVoiceSchema = z.object({
  brandId: z.string().min(1),
  samples: z.array(z.string().trim().min(20).max(12000)).min(1).max(20),
});

export const getWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  return requireAuthContext();
});

export const createBrand = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => BrandInputSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const brand = await transact((db) => {
      const timestamp = nowIso();
      const created = {
        id: newId("brand"),
        workspaceId: context.workspace.id,
        name: data.name,
        website: data.website,
        cityRegion: data.cityRegion,
        languageMarket: data.languageMarket,
        industry: data.industry,
        products: data.products,
        services: data.services,
        offers: data.offers,
        audience: data.audience,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      db.brands.push(created);
      db.brandProfiles.push({
        id: newId("voice"),
        brandId: created.id,
        businessType: "other",
        tone: "Barátságos",
        ctaStyle: "Barátságos és közvetlen",
        values: "",
        preferredPhrases: "",
        avoidedPhrases: "",
        description: "",
        approvedExamples: "",
        aiGuardrails: "Ne találj ki árakat, akciókat, nyitvatartást vagy ügyfélvéleményeket.",
        logoUrl: "",
        colors: [],
        fontFamily: "Plus Jakarta Sans",
        learningSamples: [],
        learnedSummary: "",
        learnedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return created;
    });
    const session = await useAppSession();
    await session.update({ activeBrandId: brand.id });
    return getWorkspaceSnapshot(
      await (await import("./server/store.server")).readData(),
      context.user.id,
      context.workspace.id,
      brand.id,
    );
  });

export const updateBrand = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => BrandInputSchema.extend({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    await transact((db) => {
      const brand = db.brands.find(
        (item) => item.id === data.id && item.workspaceId === context.workspace.id,
      );
      if (!brand) throw new Error("A márka nem található ebben a munkatérben.");
      Object.assign(brand, data, { updatedAt: nowIso() });
    });
    return requireAuthContext();
  });

export const deleteBrand = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ brandId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const deletedMediaIds = await transact((db) => {
      const brand = db.brands.find(
        (item) => item.id === data.brandId && item.workspaceId === context.workspace.id,
      );
      if (!brand) throw new Error("A márka nem található ebben a munkatérben.");
      const postIds = new Set(
        db.posts
          .filter((post) => post.workspaceId === context.workspace.id && post.brandId === brand.id)
          .map((post) => post.id),
      );
      const mediaIds = db.mediaAssets
        .filter((asset) => asset.workspaceId === context.workspace.id && asset.brandId === brand.id)
        .map((asset) => asset.id);
      db.planItems = db.planItems.filter(
        (item) =>
          !(
            item.workspaceId === context.workspace.id &&
            (item.brandId === brand.id || (item.postId && postIds.has(item.postId)))
          ),
      );
      db.campaigns = db.campaigns.filter(
        (campaign) =>
          !(campaign.workspaceId === context.workspace.id && campaign.brandId === brand.id),
      );
      db.postVariants = db.postVariants.filter((variant) => !postIds.has(variant.postId));
      db.postVersions = db.postVersions.filter((version) => !postIds.has(version.postId));
      db.posts = db.posts.filter(
        (post) =>
          !(
            postIds.has(post.id) &&
            post.workspaceId === context.workspace.id &&
            post.brandId === brand.id
          ),
      );
      db.mediaAssets = db.mediaAssets.filter(
        (asset) => !(asset.workspaceId === context.workspace.id && asset.brandId === brand.id),
      );
      db.analyticsSnapshots = db.analyticsSnapshots.filter(
        (snapshot) =>
          !(snapshot.workspaceId === context.workspace.id && snapshot.brandId === brand.id),
      );
      db.aiJobs = db.aiJobs.filter(
        (job) => !(job.workspaceId === context.workspace.id && job.brandId === brand.id),
      );
      db.channelConnections = db.channelConnections.filter(
        (connection) =>
          !(connection.workspaceId === context.workspace.id && connection.brandId === brand.id),
      );
      db.channelOAuthStates = db.channelOAuthStates.filter(
        (state) => !(state.workspaceId === context.workspace.id && state.brandId === brand.id),
      );
      db.channelOAuthSelections = db.channelOAuthSelections.filter(
        (selection) =>
          !(selection.workspaceId === context.workspace.id && selection.brandId === brand.id),
      );
      db.publishAttempts = db.publishAttempts.filter(
        (attempt) =>
          !(attempt.workspaceId === context.workspace.id && attempt.brandId === brand.id),
      );
      db.brands = db.brands.filter(
        (item) => !(item.id === brand.id && item.workspaceId === brand.workspaceId),
      );
      db.brandProfiles = db.brandProfiles.filter((item) => item.brandId !== brand.id);
      return mediaIds;
    });
    await Promise.allSettled(deletedMediaIds.map((mediaId) => removeMediaFile(mediaId)));
    const session = await useAppSession();
    const snapshot = await requireAuthContext();
    if (snapshot.activeBrand?.id === data.brandId)
      await session.update({ activeBrandId: snapshot.brands[0]?.id });
    return requireAuthContext();
  });

export const setActiveBrand = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ brandId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    if (!context.brands.some((brand) => brand.id === data.brandId))
      throw new Error("Nincs hozzáférés ehhez a márkához.");
    const session = await useAppSession();
    await session.update({ activeBrandId: data.brandId });
    return requireAuthContext();
  });

// A creator selection only updates this field, never overwriting the rest of Brand Voice.
export const setBrandBusinessType = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        brandId: z.string().min(1),
        businessType: z
          .string()
          .refine(
            (value) => BUSINESS_TYPES.some((item) => item.value === value),
            "Érvénytelen vállalkozástípus.",
          ),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    await transact((database) => {
      const brand = database.brands.find(
        (item) => item.id === data.brandId && item.workspaceId === context.workspace.id,
      );
      if (!brand) throw new Error("Nincs hozzáférés ehhez a márkához.");
      const profile = database.brandProfiles.find((item) => item.brandId === brand.id);
      if (!profile) throw new Error("A márkaprofil nem található.");
      profile.businessType = normalizeBusinessType(data.businessType);
      profile.updatedAt = nowIso();
    });
    return requireAuthContext();
  });

export const saveBrandVoice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => VoiceInputSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    if (!context.brands.some((brand) => brand.id === data.brandId))
      throw new Error("Nincs hozzáférés ehhez a márkához.");
    await transact((db) => {
      const timestamp = nowIso();
      const existing = db.brandProfiles.find((profile) => profile.brandId === data.brandId);
      const { brandId, ...voice } = {
        ...data,
        businessType: normalizeBusinessType(data.businessType),
      };
      if (existing) Object.assign(existing, voice, { updatedAt: timestamp });
      else
        db.brandProfiles.push({
          id: newId("voice"),
          brandId,
          ...voice,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
    });
    return requireAuthContext();
  });

/** Learn a reusable voice summary from the user's own, first-party examples. */
export const learnBrandVoice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => LearnVoiceSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const brand = context.brands.find((candidate) => candidate.id === data.brandId);
    if (!brand) throw new Error("Nincs hozzáférés ehhez a márkához.");
    const samples = data.samples.map((sample) => sample.trim()).filter(Boolean);
    const job = await transact((database) =>
      createAiJob(database, {
        workspaceId: context.workspace.id,
        brandId: brand.id,
        type: "content",
        input: { kind: "brand_voice_learning", brandId: brand.id, sampleCount: samples.length },
      }),
    );
    await transact((database) => startAiJob(database, job.id));
    try {
      const response = await openRouterChat({
        messages: [
          {
            role: "system",
            content:
              "Magyar márkastratéga vagy. Elemezd a felhasználó saját posztpéldáit, és foglald össze a visszatérő kommunikációs stílust. Ne találj ki üzleti tényeket. A választ csak a megadott JSON sémában add vissza.",
          },
          {
            role: "user",
            content: `Üzleti kontextus:\n${businessContextPrompt(buildBusinessContext(brand, brand.profile))}\n\nSaját posztpéldák:\n${samples.map((sample, index) => `--- ${index + 1} ---\n${sample}`).join("\n")}`,
          },
        ],
        schemaName: "brand_voice_learning",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["summary", "tone", "patterns", "doNotChange"],
          properties: {
            summary: { type: "string" },
            tone: { type: "string" },
            patterns: { type: "array", items: { type: "string" } },
            doNotChange: { type: "array", items: { type: "string" } },
          },
        },
      });
      if (!response.ok)
        throw new Error(`AI hiba (${response.status}): ${(await response.text()).slice(0, 200)}`);
      const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const raw = json.choices?.[0]?.message?.content;
      if (!raw) throw new Error("Az AI üres márkahang-összefoglalót adott.");
      const parsed = z
        .object({
          summary: z.string().max(12000),
          tone: z.string().max(1000),
          patterns: z.array(z.string().max(1000)).max(20),
          doNotChange: z.array(z.string().max(1000)).max(20),
        })
        .parse(JSON.parse(raw));
      const learnedSummary = [
        parsed.summary,
        `Jellemző hangnem: ${parsed.tone}.`,
        parsed.patterns.length ? `Visszatérő minták: ${parsed.patterns.join("; ")}.` : "",
        parsed.doNotChange.length ? `Megőrzendő elemek: ${parsed.doNotChange.join("; ")}.` : "",
      ]
        .filter(Boolean)
        .join("\n");
      await transact((database) => {
        const profile = database.brandProfiles.find((candidate) => candidate.brandId === brand.id);
        if (!profile) throw new Error("A Brand Voice profil nem található.");
        profile.learningSamples = samples;
        profile.learnedSummary = learnedSummary;
        profile.learnedAt = nowIso();
        profile.updatedAt = nowIso();
      });
      await transact((database) => completeAiJob(database, job.id));
      return requireAuthContext();
    } catch (cause) {
      await transact((database) =>
        completeAiJob(
          database,
          job.id,
          cause instanceof Error ? cause.message : "Márkahang-tanulási hiba",
        ),
      );
      throw cause;
    }
  });
