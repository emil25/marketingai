import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  CampaignRecord,
  CampaignStrategy,
  PlanItemRecord,
  PostPlatform,
  PostStatus,
  PostRecord,
  WorkspaceSnapshot,
} from "@/lib/data-model";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import {
  completeAiJob,
  createAiJob,
  newId,
  nowIso,
  readData,
  startAiJob,
  transact,
} from "@/lib/server/store.server";
import { openRouterChat } from "@/lib/server/ai-provider.server";
import { buildBusinessContext, businessContextPrompt } from "@/lib/business-types";
import { parsePostScheduleInput } from "@/lib/post-schedule";

const platforms = [
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
  "youtube",
  "google-business",
] as const;
const campaignStatuses = [
  "draft",
  "planning",
  "active",
  "paused",
  "completed",
  "archived",
] as const;
const planStatuses = [
  "idea",
  "planned",
  "draft",
  "ready",
  "scheduled",
  "published",
  "skipped",
] as const;
const PlatformSchema = z.enum(platforms);
const CampaignStatusSchema = z.enum(campaignStatuses);
const PlanStatusSchema = z.enum(planStatuses);
const CalendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Érvénytelen naptári dátum.");
const CalendarTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Érvénytelen időpont.");

const CampaignInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  objective: z.string().trim().min(1).max(240),
  audience: z.string().trim().max(4000).default(""),
  offer: z.string().trim().max(4000).default(""),
  description: z.string().trim().max(8000).default(""),
  startDate: CalendarDateSchema,
  endDate: CalendarDateSchema,
  timezone: z.string().trim().max(100).default("Europe/Bucharest"),
  budget: z.number().nonnegative().nullable().default(null),
  successCriteria: z.string().trim().max(2000).default(""),
  channels: z.array(PlatformSchema).min(1).max(6),
  cta: z.string().trim().max(1000).default(""),
  status: CampaignStatusSchema.default("draft"),
});

const CampaignUpdateSchema = CampaignInputSchema.partial().extend({
  campaignId: z.string().min(1),
});
const PlanItemUpdateSchema = z.object({
  planItemId: z.string().min(1),
  fields: z.object({
    date: CalendarDateSchema.optional(),
    time: CalendarTimeSchema.nullable().optional(),
    platform: PlatformSchema.optional(),
    contentType: z.string().trim().max(120).optional(),
    topic: z.string().trim().max(1000).optional(),
    objective: z.string().trim().max(240).optional(),
    status: PlanStatusSchema.optional(),
  }),
});

const CampaignPlanSchema = z.object({
  summary: z.string().max(6000),
  mainMessage: z.string().max(2000),
  cta: z.string().max(1000),
  contentPillars: z.array(z.string().max(300)).min(1).max(8),
  recommendedFrequency: z.string().max(300),
  channelStrategies: z.record(z.string(), z.string().max(1200)),
  items: z
    .array(
      z.object({
        day: z.number().int().min(1).max(30),
        time: z.string().max(20).nullable().optional(),
        platform: PlatformSchema,
        contentType: z.string().max(120),
        topic: z.string().max(1000),
        objective: z.string().max(240),
      }),
    )
    .min(30)
    .max(90),
});

const SingleVariantSchema = z.object({
  content: z.string().trim().min(1).max(30000),
  hashtags: z.array(z.string().max(80)).max(40).default([]),
  cta: z.string().max(1000).default(""),
});

const CAMPAIGN_PLAN_RESULT = {
  type: "object",
  additionalProperties: false,
  required: [
    "summary",
    "mainMessage",
    "cta",
    "contentPillars",
    "recommendedFrequency",
    "channelStrategies",
    "items",
  ],
  properties: {
    summary: { type: "string" },
    mainMessage: { type: "string" },
    cta: { type: "string" },
    contentPillars: { type: "array", items: { type: "string" } },
    recommendedFrequency: { type: "string" },
    channelStrategies: {
      type: "object",
      additionalProperties: false,
      required: [...platforms],
      properties: {
        facebook: { type: "string" },
        instagram: { type: "string" },
        tiktok: { type: "string" },
        linkedin: { type: "string" },
        youtube: { type: "string" },
        "google-business": { type: "string" },
      },
    },
    items: {
      type: "array",
      minItems: 30,
      maxItems: 90,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "time", "platform", "contentType", "topic", "objective"],
        properties: {
          day: { type: "integer", minimum: 1, maximum: 30 },
          time: { type: ["string", "null"] },
          platform: { type: "string", enum: [...platforms] },
          contentType: { type: "string" },
          topic: { type: "string" },
          objective: { type: "string" },
        },
      },
    },
  },
} as const;

const SINGLE_VARIANT_RESULT = {
  type: "object",
  additionalProperties: false,
  required: ["content", "hashtags", "cta"],
  properties: {
    content: { type: "string" },
    hashtags: { type: "array", items: { type: "string" } },
    cta: { type: "string" },
  },
} as const;

export type CampaignSnapshot = CampaignRecord & {
  brandName: string;
  planItems: PlanItemRecord[];
  posts: PostRecord[];
  counts: { planned: number; created: number; drafts: number; remaining: number };
};

export type PlannerItemSnapshot = PlanItemRecord & {
  campaignName: string | null;
  brandName: string;
  postTitle: string | null;
  postStatus: PostStatus | null;
};

function ownsBrand(context: WorkspaceSnapshot, brandId: string) {
  return context.brands.some((brand) => brand.id === brandId);
}

function campaignSnapshot(
  database: Awaited<ReturnType<typeof readData>>,
  context: WorkspaceSnapshot,
  campaign: CampaignRecord,
): CampaignSnapshot {
  const candidatePlanItems = database.planItems.filter(
    (item) =>
      item.campaignId === campaign.id &&
      item.workspaceId === context.workspace.id &&
      item.brandId === campaign.brandId,
  );
  const linkedPostIds = new Set(
    candidatePlanItems
      .map((item) => item.postId)
      .filter((postId): postId is string => Boolean(postId)),
  );
  const posts = database.posts.filter(
    (post) =>
      (post.campaignId === campaign.id || linkedPostIds.has(post.id)) &&
      post.workspaceId === context.workspace.id &&
      post.brandId === campaign.brandId,
  );
  const existingPostIds = new Set(posts.map((post) => post.id));
  const planItems = candidatePlanItems.map((item) =>
    item.postId && !existingPostIds.has(item.postId) ? { ...item, postId: null } : item,
  );
  const created = planItems.filter((item) => Boolean(item.postId)).length;
  const planned = planItems.length;
  return {
    ...campaign,
    brandName:
      context.brands.find((brand) => brand.id === campaign.brandId)?.name ?? "Ismeretlen márka",
    planItems,
    posts,
    counts: {
      planned,
      created,
      drafts: posts.filter((post) => post.status === "draft").length,
      remaining: planItems.filter((item) => !item.postId && item.status !== "skipped").length,
    },
  };
}

function findCampaign(
  database: Awaited<ReturnType<typeof readData>>,
  context: WorkspaceSnapshot,
  campaignId: string,
) {
  const campaign = database.campaigns.find(
    (item) => item.id === campaignId && item.workspaceId === context.workspace.id,
  );
  if (!campaign || !ownsBrand(context, campaign.brandId))
    throw new Error("Nincs hozzáférés ehhez a kampányhoz.");
  return campaign;
}

function findPlanItem(
  database: Awaited<ReturnType<typeof readData>>,
  context: WorkspaceSnapshot,
  planItemId: string,
) {
  const item = database.planItems.find(
    (candidate) => candidate.id === planItemId && candidate.workspaceId === context.workspace.id,
  );
  if (!item || !ownsBrand(context, item.brandId))
    throw new Error("Nincs hozzáférés ehhez a tervtételhez.");
  if (item.campaignId) {
    const campaign = database.campaigns.find(
      (candidate) =>
        candidate.id === item.campaignId &&
        candidate.workspaceId === context.workspace.id &&
        candidate.brandId === item.brandId,
    );
    if (!campaign) throw new Error("A tervtétel kampánya nem található.");
  }
  return item;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export const getCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  const context = await requireAuthContext();
  const database = await readData();
  return database.campaigns
    .filter(
      (campaign) =>
        campaign.workspaceId === context.workspace.id && ownsBrand(context, campaign.brandId),
    )
    .map((campaign) => campaignSnapshot(database, context, campaign));
});

export const getCampaign = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ campaignId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const database = await readData();
    return campaignSnapshot(database, context, findCampaign(database, context, data.campaignId));
  });

export const getPlanner = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ campaignId: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const database = await readData();
    if (data.campaignId) findCampaign(database, context, data.campaignId);
    return plannerItems(database, context, data.campaignId);
  });

function plannerItems(
  database: Awaited<ReturnType<typeof readData>>,
  context: WorkspaceSnapshot,
  campaignId?: string,
): PlannerItemSnapshot[] {
  const campaigns = new Map(
    database.campaigns
      .filter(
        (campaign) =>
          campaign.workspaceId === context.workspace.id && ownsBrand(context, campaign.brandId),
      )
      .map((campaign) => [campaign.id, campaign]),
  );
  const posts = new Map(
    database.posts
      .filter(
        (post) => post.workspaceId === context.workspace.id && ownsBrand(context, post.brandId),
      )
      .map((post) => [post.id, post]),
  );
  return database.planItems
    .filter(
      (item) =>
        item.workspaceId === context.workspace.id &&
        ownsBrand(context, item.brandId) &&
        (!campaignId || item.campaignId === campaignId),
    )
    .map((item): PlannerItemSnapshot => {
      const post = item.postId ? posts.get(item.postId) : undefined;
      return {
        ...item,
        postId: post?.id ?? null,
        campaignName: item.campaignId ? (campaigns.get(item.campaignId)?.name ?? null) : null,
        brandName:
          context.brands.find((brand) => brand.id === item.brandId)?.name ?? "Ismeretlen márka",
        postTitle: post?.title ?? null,
        postStatus: post?.status ?? null,
      };
    })
    .sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
}

export const createCampaignAndPlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CampaignInputSchema.parse(data))
  .handler(async ({ data }) => createCampaignPlan(data, 30));

export const createWeeklyMarketingPlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        brief: z.string().trim().min(10).max(4000),
        startDate: CalendarDateSchema,
        channels: z.array(PlatformSchema).min(1).max(4),
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    createCampaignPlan(
      CampaignInputSchema.parse({
        name: `Heti marketing · ${data.startDate}`,
        objective: "Érdeklődés és ügyfélszerzés",
        description: data.brief,
        offer: data.brief,
        startDate: data.startDate,
        endDate: addDays(data.startDate, 6),
        channels: [...new Set(data.channels)],
      }),
      7,
    ),
  );

async function createCampaignPlan(data: z.infer<typeof CampaignInputSchema>, days: 7 | 30) {
  if (data.endDate < data.startDate)
    throw new Error("A kampány záró dátuma nem lehet a kezdő dátum előtt.");
  if (data.endDate < addDays(data.startDate, days - 1))
    throw new Error("A kampány időtartama túl rövid a kért tervhez.");
  const context = await requireAuthContext();
  const brand = context.activeBrand;
  if (!brand) throw new Error("Aktív márka szükséges a kampány indításához.");
  const campaign = await transact((database) => {
    const timestamp = nowIso();
    const created: CampaignRecord = {
      id: newId("campaign"),
      workspaceId: context.workspace.id,
      brandId: brand.id,
      name: data.name,
      objective: data.objective,
      audience: data.audience || brand.audience,
      offer: data.offer,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      timezone: data.timezone,
      status: "planning",
      budget: data.budget,
      successCriteria: data.successCriteria,
      channels: data.channels,
      cta: data.cta || brand.profile.ctaStyle,
      strategy: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    database.campaigns.push(created);
    return created;
  });
  const businessContext = buildBusinessContext(brand, brand.profile, {
    goal: data.objective,
    audience: data.audience || brand.audience,
    language: brand.languageMarket,
    platform: data.channels.join(", "),
  });
  const job = await transact((database) =>
    createAiJob(database, {
      workspaceId: context.workspace.id,
      brandId: brand.id,
      type: "campaign",
      input: {
        businessContext,
        workspace: context.workspace.name,
        campaignId: campaign.id,
        ...data,
        brandVoice: brand.profile,
        brand: {
          name: brand.name,
          industry: brand.industry,
          products: brand.products,
          services: brand.services,
          offers: brand.offers,
          audience: brand.audience,
          cityRegion: brand.cityRegion,
          languageMarket: brand.languageMarket,
        },
      },
    }),
  );
  await transact((database) => startAiJob(database, job.id));
  try {
    const planningInstruction =
      days === 7
        ? "Készíts rövid heti stratégiát és pontosan 4 különböző posztot 7 napra. Minden kiválasztott csatorna szerepeljen legalább egyszer. Különböző napokra oszd a tartalmakat; day 1–7. Ne találj ki árakat, kedvezményt, elérhetőséget vagy tényeket."
        : "Készíts szerkeszthető, strukturált stratégiai összefoglalót és legalább 30 tervtételt. A day mező 1 és 30 közötti legyen, és minden nap legalább egyszer szerepeljen.";
    const system = `Magyar nyelvű marketingstratéga vagy. A strukturált üzleti kontextus, amelyet minden kampányszerkezethez használnod kell: ${businessContextPrompt(businessContext)}. Munkatér: ${context.workspace.name}. Márka: ${brand.name}. Iparág: ${brand.industry}. Termékek: ${brand.products}. Szolgáltatások: ${brand.services}. Ajánlatok: ${brand.offers}. Régió: ${brand.cityRegion}. Nyelv: ${brand.languageMarket}. Brand Voice: ${brand.profile.tone}; CTA: ${brand.profile.ctaStyle}; értékek: ${brand.profile.values}; kerülendő kifejezések: ${brand.profile.avoidedPhrases}; tanult márkahang: ${brand.profile.learnedSummary ?? "nincs még tanult összefoglaló"}; guardrail: ${brand.profile.aiGuardrails}. Kitalált tényeket ne írj. ${planningInstruction}`;
    const user = `Kampány neve: ${data.name}\nCél: ${data.objective}\nKözönség: ${data.audience || brand.audience}\nAjánlat: ${data.offer}\nLeírás: ${data.description}\nIdőtartam: ${data.startDate}–${data.endDate} (${data.timezone})\nCsatornák: ${data.channels.join(", ")}\nCTA: ${data.cta || brand.profile.ctaStyle}\nSikerfeltétel: ${data.successCriteria}.`;
    const weeklySchema = {
      ...CAMPAIGN_PLAN_RESULT,
      properties: {
        ...CAMPAIGN_PLAN_RESULT.properties,
        items: {
          ...CAMPAIGN_PLAN_RESULT.properties.items,
          minItems: 4,
          maxItems: 4,
          items: {
            ...CAMPAIGN_PLAN_RESULT.properties.items.items,
            properties: {
              ...CAMPAIGN_PLAN_RESULT.properties.items.items.properties,
              day: { type: "integer", minimum: 1, maximum: 7 },
            },
          },
        },
      },
    };
    const response = await openRouterChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      schemaName: "campaign_plan",
      schema: days === 7 ? weeklySchema : CAMPAIGN_PLAN_RESULT,
      maxTokens: days === 7 ? 3500 : undefined,
    });
    if (!response.ok)
      throw new Error(`AI hiba (${response.status}): ${(await response.text()).slice(0, 200)}`);
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Az AI üres kampánytervet adott.");
    const strategy = (
      days === 30
        ? CampaignPlanSchema
        : CampaignPlanSchema.extend({
            items: CampaignPlanSchema.shape.items.element
              .extend({
                day: z.number().int().min(1).max(7),
                time: CalendarTimeSchema.nullable(),
                topic: z.string().trim().min(1).max(1000),
              })
              .array()
              .length(4),
          })
    ).parse(JSON.parse(raw));
    const allowed = new Set(data.channels);
    const usableItems = strategy.items.filter((item) => allowed.has(item.platform)).slice(0, 90);
    if (usableItems.length < (days === 7 ? 4 : 30))
      throw new Error("Az AI nem adott elegendő, kiválasztott csatornához tartozó tervtételt.");
    if (
      days === 7 &&
      data.channels.some((channel) => !usableItems.some((item) => item.platform === channel))
    )
      throw new Error("Az AI-terv nem tartalmazza az összes kiválasztott csatornát. Próbáld újra.");
    const missingDays = Array.from({ length: days === 7 ? 0 : 30 }, (_, index) => index + 1).filter(
      (day) => !usableItems.some((item) => item.day === day),
    );
    // Models can occasionally repeat a day even when they return 30 items.
    // Preserve the generated content and cover missing calendar days by
    // assigning the existing plan item to the missing day.
    const coverageItems = missingDays.map((day, index) => ({
      ...(usableItems[index % usableItems.length] ?? usableItems[0]),
      day,
    }));
    const planItems = [...usableItems, ...coverageItems];
    const saved = await transact((database) => {
      const current = database.campaigns.find(
        (item) =>
          item.id === campaign.id &&
          item.workspaceId === context.workspace.id &&
          item.brandId === brand.id,
      );
      if (!current) throw new Error("A kampány nem található.");
      const normalizedStrategy: CampaignStrategy = {
        summary: strategy.summary,
        mainMessage: strategy.mainMessage,
        cta: strategy.cta,
        contentPillars: strategy.contentPillars,
        recommendedFrequency: strategy.recommendedFrequency,
        channelStrategies: strategy.channelStrategies,
      };
      current.strategy = normalizedStrategy;
      current.status = "active";
      current.updatedAt = nowIso();
      const timestamp = nowIso();
      for (const item of planItems) {
        const validTime =
          item.time && CalendarTimeSchema.safeParse(item.time).success ? item.time : null;
        database.planItems.push({
          id: newId("plan"),
          workspaceId: context.workspace.id,
          brandId: brand.id,
          campaignId: current.id,
          postId: null,
          date: addDays(current.startDate, item.day - 1),
          time: validTime,
          timezone: current.timezone,
          platform: item.platform,
          contentType: item.contentType,
          topic: item.topic,
          objective: item.objective || current.objective,
          status: "planned",
          aiGenerated: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
      return current.id;
    });
    await transact((database) => completeAiJob(database, job.id));
    const database = await readData();
    return campaignSnapshot(database, context, findCampaign(database, context, saved));
  } catch (cause) {
    await transact((database) => {
      const current = database.campaigns.find(
        (item) =>
          item.id === campaign.id &&
          item.workspaceId === context.workspace.id &&
          item.brandId === brand.id,
      );
      if (current) {
        current.status = "draft";
        current.updatedAt = nowIso();
      }
    });
    await transact((database) =>
      completeAiJob(
        database,
        job.id,
        cause instanceof Error ? cause.message : "AI kampányterv hiba",
      ),
    );
    throw cause;
  }
}

export const updateCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CampaignUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const result = await transact((database) => {
      const campaign = findCampaign(database, context, data.campaignId);
      const nextStart = data.startDate ?? campaign.startDate;
      const nextEnd = data.endDate ?? campaign.endDate;
      if (nextEnd < nextStart)
        throw new Error("A kampány záró dátuma nem lehet a kezdő dátum előtt.");
      if (nextEnd < addDays(nextStart, campaign.endDate < addDays(campaign.startDate, 29) ? 6 : 29))
        throw new Error("A kampány időtartama túl rövid a meglévő tervhez.");
      const { campaignId: _campaignId, ...fields } = data;
      const timestamp = nowIso();
      Object.assign(campaign, fields, { updatedAt: timestamp });
      if (data.timezone !== undefined)
        for (const planItem of database.planItems)
          if (
            planItem.campaignId === campaign.id &&
            planItem.workspaceId === campaign.workspaceId &&
            planItem.brandId === campaign.brandId
          ) {
            planItem.timezone = data.timezone;
            planItem.updatedAt = timestamp;
          }
      return campaign.id;
    });
    const database = await readData();
    return campaignSnapshot(database, context, findCampaign(database, context, result));
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ campaignId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    await transact((database) => {
      const campaign = findCampaign(database, context, data.campaignId);
      database.campaigns = database.campaigns.filter(
        (item) =>
          !(
            item.id === campaign.id &&
            item.workspaceId === campaign.workspaceId &&
            item.brandId === campaign.brandId
          ),
      );
      database.planItems = database.planItems.filter(
        (item) =>
          !(
            item.campaignId === campaign.id &&
            item.workspaceId === campaign.workspaceId &&
            item.brandId === campaign.brandId
          ),
      );
      for (const post of database.posts)
        if (
          post.campaignId === campaign.id &&
          post.workspaceId === campaign.workspaceId &&
          post.brandId === campaign.brandId
        )
          post.campaignId = null;
    });
    return { ok: true };
  });

export const updatePlanItem = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PlanItemUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const itemId = await transact((database) => {
      const item = findPlanItem(database, context, data.planItemId);
      if (data.fields.status === "published")
        throw new Error("Publikálás csak kapcsolt csatornán lesz elérhető.");
      const nextDate = data.fields.date ?? item.date;
      const nextTime = data.fields.time !== undefined ? data.fields.time : item.time;
      const finalStatus = data.fields.status ?? item.status;
      if (finalStatus === "scheduled" && !nextTime)
        throw new Error("Az ütemezett tervtételhez időpont szükséges.");
      const nextScheduledAt = nextTime
        ? parsePostScheduleInput(`${nextDate}T${nextTime}`, item.timezone)
        : null;
      const timestamp = nowIso();
      const contentContextChanged =
        (data.fields.platform !== undefined && data.fields.platform !== item.platform) ||
        (data.fields.contentType !== undefined && data.fields.contentType !== item.contentType) ||
        (data.fields.topic !== undefined && data.fields.topic !== item.topic) ||
        (data.fields.objective !== undefined && data.fields.objective !== item.objective);
      Object.assign(item, data.fields, { updatedAt: timestamp });
      if (item.postId) {
        const post = database.posts.find(
          (candidate) =>
            candidate.id === item.postId &&
            candidate.workspaceId === item.workspaceId &&
            candidate.brandId === item.brandId,
        );
        if (
          post &&
          (data.fields.date !== undefined ||
            data.fields.time !== undefined ||
            data.fields.status === "scheduled")
        ) {
          post.scheduledAt = nextScheduledAt;
          post.timezone = item.timezone;
          post.updatedAt = timestamp;
          for (const sibling of database.planItems)
            if (
              sibling.postId === post.id &&
              sibling.workspaceId === post.workspaceId &&
              sibling.brandId === post.brandId &&
              sibling.status !== "skipped"
            ) {
              sibling.date = nextDate;
              sibling.time = nextTime;
              sibling.timezone = item.timezone;
              sibling.updatedAt = timestamp;
            }
        }
        if (post && contentContextChanged) {
          post.status = "draft";
          post.updatedAt = timestamp;
        }
        if (post && data.fields.status === "scheduled") {
          post.status = "scheduled";
          post.updatedAt = timestamp;
        }
        if (contentContextChanged && data.fields.status === undefined && item.status !== "skipped")
          item.status = "draft";
      }
      return item.id;
    });
    const database = await readData();
    return plannerItems(database, context).find((item) => item.id === itemId) ?? null;
  });

async function generatePlanItemPost(
  context: WorkspaceSnapshot,
  planItemId: string,
  missingOnly = false,
) {
  const initialDatabase = await readData();
  const item = findPlanItem(initialDatabase, context, planItemId);
  if (
    missingOnly &&
    item.postId &&
    initialDatabase.posts.some(
      (post) =>
        post.id === item.postId &&
        post.workspaceId === item.workspaceId &&
        post.brandId === item.brandId,
    )
  )
    return item.postId;
  const brand = context.brands.find((candidate) => candidate.id === item.brandId);
  if (!brand) throw new Error("A tervtétel márkája nem található.");
  const campaign = item.campaignId
    ? initialDatabase.campaigns.find(
        (candidate) =>
          candidate.id === item.campaignId &&
          candidate.workspaceId === context.workspace.id &&
          candidate.brandId === item.brandId,
      )
    : undefined;
  if (item.status === "skipped")
    throw new Error("A kihagyott tervtétel előbb állítsd vissza tervezett állapotra.");
  const businessContext = buildBusinessContext(brand, brand.profile, {
    goal: item.objective,
    audience: campaign?.audience || brand.audience,
    language: brand.languageMarket,
    platform: item.platform,
  });
  const job = await transact((database) =>
    createAiJob(database, {
      workspaceId: context.workspace.id,
      brandId: brand.id,
      type: "content",
      input: {
        businessContext,
        workspace: context.workspace.name,
        brand: {
          name: brand.name,
          industry: brand.industry,
          products: brand.products,
          services: brand.services,
          offers: brand.offers,
          audience: brand.audience,
          cityRegion: brand.cityRegion,
          languageMarket: brand.languageMarket,
        },
        planItemId: item.id,
        campaignId: campaign?.id ?? null,
        campaign: campaign
          ? {
              name: campaign.name,
              objective: campaign.objective,
              audience: campaign.audience,
              offer: campaign.offer,
              description: campaign.description,
              cta: campaign.cta,
              timezone: campaign.timezone,
            }
          : null,
        platform: item.platform,
        contentType: item.contentType,
        topic: item.topic,
        objective: item.objective,
        brandVoice: brand.profile,
        campaignStrategy: campaign?.strategy ?? null,
      },
    }),
  );
  await transact((database) => startAiJob(database, job.id));
  try {
    const system = `Magyar nyelvű social media szövegíró vagy. A strukturált üzleti kontextus: ${businessContextPrompt(businessContext)}. Munkatér: ${context.workspace.name}. Márka: ${brand.name}. Iparág: ${brand.industry}. Termékek: ${brand.products}. Szolgáltatások: ${brand.services}. Ajánlatok: ${brand.offers}. Márka közönsége: ${brand.audience}. Régió: ${brand.cityRegion}. Nyelv: ${brand.languageMarket}. Brand Voice: ${brand.profile.tone}; CTA: ${brand.profile.ctaStyle}; értékek: ${brand.profile.values}; preferált kifejezések: ${brand.profile.preferredPhrases}; kerülendő: ${brand.profile.avoidedPhrases}; tanult márkahang: ${brand.profile.learnedSummary ?? "nincs még tanult összefoglaló"}; guardrail: ${brand.profile.aiGuardrails}. Kitalált tényeket ne írj. Egyetlen, szerkeszthető platformváltozatot adj vissza.`;
    const user = `Kampány: ${campaign?.name ?? "Önálló tervtétel"}\nKampány célja: ${campaign?.objective ?? item.objective}\nKampány közönsége: ${campaign?.audience ?? brand.audience}\nKampány ajánlata: ${campaign?.offer ?? brand.offers}\nKampány leírása: ${campaign?.description ?? ""}\nKampány stratégiai összefoglaló: ${campaign?.strategy?.summary ?? ""}\nFő üzenet: ${campaign?.strategy?.mainMessage ?? ""}\nTervtétel dátuma: ${item.date}\nPlatform: ${item.platform}\nTartalomtípus: ${item.contentType}\nTéma: ${item.topic}\nTervtétel célja: ${item.objective}\nKampány CTA: ${campaign?.cta ?? brand.profile.ctaStyle}`;
    const response = await openRouterChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      schemaName: "plan_item_variant",
      schema: SINGLE_VARIANT_RESULT,
      maxTokens: 2000,
    });
    if (!response.ok)
      throw new Error(`AI hiba (${response.status}): ${(await response.text()).slice(0, 200)}`);
    const json = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Az AI üres posztváltozatot adott.");
    const variant = SingleVariantSchema.parse(JSON.parse(raw));
    const postId = await transact((database) => {
      const currentItem = findPlanItem(database, context, item.id);
      if (currentItem.status === "skipped")
        throw new Error("A tervtételt közben kihagyták; állítsd vissza, majd indítsd újra.");
      const timestamp = nowIso();
      let post = currentItem.postId
        ? database.posts.find(
            (candidate) =>
              candidate.id === currentItem.postId &&
              candidate.workspaceId === context.workspace.id &&
              candidate.brandId === brand.id,
          )
        : undefined;
      if (!post) {
        post = {
          id: newId("post"),
          workspaceId: context.workspace.id,
          brandId: brand.id,
          campaignId: campaign?.id ?? null,
          title: `${campaign?.name ?? "Tervtétel"} – ${currentItem.topic}`.slice(0, 240),
          goal: currentItem.objective,
          audience: campaign?.audience || brand.audience,
          language: brand.languageMarket,
          tone: brand.profile.tone,
          status: "draft",
          scheduledAt: null,
          timezone: campaign?.timezone ?? "Europe/Bucharest",
          mediaAssetIds: [],
          hooks: [],
          selectedHook: null,
          abVariants: [],
          adCopies: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        } satisfies PostRecord;
        database.posts.push(post);
        database.postVariants.push({
          id: newId("variant"),
          postId: post.id,
          platform: currentItem.platform,
          content: variant.content,
          hashtags: variant.hashtags,
          cta: variant.cta,
          status: "prepared",
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      } else {
        if (missingOnly) return post.id; // A concurrent request finished; preserve its content and user edits.
        post.updatedAt = timestamp;
        post.status = "draft";
        const existingVariant = database.postVariants.find(
          (candidate) =>
            candidate.postId === post!.id && candidate.platform === currentItem.platform,
        );
        if (existingVariant) {
          database.postVersions.push({
            id: newId("version"),
            postId: post.id,
            variantId: existingVariant.id,
            content: existingVariant.content,
            createdAt: timestamp,
            createdBy: context.user.id,
          });
          Object.assign(existingVariant, {
            content: variant.content,
            hashtags: variant.hashtags,
            cta: variant.cta,
            status: "prepared" as const,
            updatedAt: timestamp,
          });
        } else
          database.postVariants.push({
            id: newId("variant"),
            postId: post.id,
            platform: currentItem.platform,
            content: variant.content,
            hashtags: variant.hashtags,
            cta: variant.cta,
            status: "prepared",
            createdAt: timestamp,
            updatedAt: timestamp,
          });
      }
      currentItem.postId = post.id;
      currentItem.status = "draft";
      currentItem.updatedAt = timestamp;
      return post.id;
    });
    await transact((database) => completeAiJob(database, job.id));
    return postId;
  } catch (cause) {
    await transact((database) =>
      completeAiJob(database, job.id, cause instanceof Error ? cause.message : "AI poszt hiba"),
    );
    throw cause;
  }
}

export const createPostFromPlanItem = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ planItemId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const postId = await generatePlanItemPost(context, data.planItemId);
    return { postId };
  });

export const createMissingPlanItemPost = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ planItemId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    return { postId: await generatePlanItemPost(context, data.planItemId, true) };
  });

export const regeneratePlanItem = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ planItemId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const postId = await generatePlanItemPost(context, data.planItemId);
    return { postId };
  });

export const generatePlanItems = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ planItemIds: z.array(z.string().min(1)).min(1).max(90) }).parse(data),
  )
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const completed: Array<{ planItemId: string; postId: string }> = [];
    const failed: Array<{ planItemId: string; error: string }> = [];
    for (const planItemId of [...new Set(data.planItemIds)]) {
      try {
        completed.push({ planItemId, postId: await generatePlanItemPost(context, planItemId) });
      } catch (cause) {
        failed.push({ planItemId, error: cause instanceof Error ? cause.message : "AI hiba" });
      }
    }
    return { completed, failed };
  });

/** Generate every remaining plan item in one explicit, resumable campaign action. */
export const generateCampaignContentPackage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ campaignId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const database = await readData();
    const campaign = findCampaign(database, context, data.campaignId);
    const planItemIds = database.planItems
      .filter(
        (item) =>
          item.campaignId === campaign.id &&
          item.workspaceId === context.workspace.id &&
          item.brandId === campaign.brandId &&
          !item.postId &&
          item.status !== "skipped",
      )
      .map((item) => item.id);
    const completed: Array<{ planItemId: string; postId: string }> = [];
    const failed: Array<{ planItemId: string; error: string }> = [];
    for (const planItemId of planItemIds) {
      try {
        completed.push({ planItemId, postId: await generatePlanItemPost(context, planItemId) });
      } catch (cause) {
        failed.push({ planItemId, error: cause instanceof Error ? cause.message : "AI hiba" });
      }
    }
    return { campaignId: campaign.id, total: planItemIds.length, completed, failed };
  });
