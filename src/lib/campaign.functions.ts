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
import { generateFactualPost } from "@/lib/server/post-content.server";
import { plannerContentPreview } from "@/lib/server/planner-preview.server";
import { campaignWeeks, generateWeeklyPlan } from "@/lib/server/weekly-plan.server";
import {
  storedCampaignWeeks,
  applyCompleteCampaignWeeks,
  planDuration,
  resumableCampaignWeeks,
} from "@/lib/server/campaign-week-store.server";
import type { WeekPlan } from "@/lib/server/weekly-plan.server";
import { assertContentReady, contentPlaceholders } from "@/lib/content-quality";
import { buildBusinessContext } from "@/lib/business-types";
import { localMarketEvents } from "@/lib/market/ro";
import { parsePostScheduleInput } from "@/lib/post-schedule";
import {
  campaignContentBlockers,
  campaignDisplayNames,
  campaignGeneration,
  campaignJobRunning,
  campaignJobs,
  uniqueCampaignName,
} from "@/lib/campaign-presentation";

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
  requestId: z.string().uuid().optional(),
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

const CampaignUpdateSchema = CampaignInputSchema.omit({ requestId: true })
  .partial()
  .extend({
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

export type CampaignSnapshot = CampaignRecord & {
  generation: ReturnType<typeof campaignGeneration>;
  contentBlockers: ReturnType<typeof campaignContentBlockers>;
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
  postContent?: string | null;
  postImage?: { id: string; altText: string } | null;
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
    name:
      campaignDisplayNames(
        database.campaigns.filter(
          (item) => item.workspaceId === campaign.workspaceId && item.brandId === campaign.brandId,
        ),
      ).get(campaign.id) ?? campaign.name,
    generation: campaignGeneration(campaign, database.aiJobs, planned),
    contentBlockers: campaignContentBlockers(posts, database.postVariants),
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
    .filter((campaign) => campaign.strategy || database.planItems.some((p) => p.campaignId === campaign.id) || !campaignJobs(campaign, database.aiJobs).some((j) => j.status === "failed"))
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
      const candidate = item.postId ? posts.get(item.postId) : undefined;
      const post = candidate?.brandId === item.brandId ? candidate : undefined;
      const preview = plannerContentPreview(database, item);
      return {
        ...item,
        postId: post?.id ?? null,
        campaignName: item.campaignId ? (campaigns.get(item.campaignId)?.name ?? null) : null,
        brandName:
          context.brands.find((brand) => brand.id === item.brandId)?.name ?? "Ismeretlen márka",
        postTitle: post?.title ?? null,
        postStatus: post?.status ?? null,
        postContent: preview.postContent,
        postImage: preview.postImage,
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
        requestId: z.string().uuid().optional(),
        brief: z.string().trim().min(10).max(4000),
        startDate: CalendarDateSchema,
        channels: z.array(PlatformSchema).min(1).max(4),
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    createCampaignPlan(
      CampaignInputSchema.parse({
        requestId: data.requestId,
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

export const retryCampaignPlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ campaignId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const campaign = findCampaign(await readData(), context, data.campaignId);
    return createCampaignPlan(
      CampaignInputSchema.parse(campaign),
      planDuration(campaign),
      campaign.id,
    );
  });

export const getCampaignAttempts = createServerFn({ method: "GET" }).handler(async () => {
  const context = await requireAuthContext();
  const db = await readData();
  return db.aiJobs.filter((j) => j.type === "campaign" && j.workspaceId === context.workspace.id && j.input.userId === context.user.id && ownsBrand(context, j.brandId) && j.status !== "completed" && !db.campaigns.some((c) => c.id === j.input.campaignId && (c.strategy || db.planItems.some((p) => p.campaignId === c.id))))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((j) => ({ id: j.id, brandId: j.brandId, createdAt: j.createdAt, days: j.input.days === 7 ? 7 : 30, name: String(j.input.name || "Kampányterv"), status: campaignJobRunning(j) ? "running" as const : "failed" as const, completedWeeks: storedCampaignWeeks(j.input).length, error: j.error || "A generálás megszakadt. Újrapróbálhatod.", legacyCampaignId: db.campaigns.some((c) => c.id === j.input.campaignId) ? String(j.input.campaignId) : null }));
});
export const retryCampaignAttempt = createServerFn({ method: "POST" }).inputValidator((data: unknown) => z.object({ attemptId: z.string().min(1) }).parse(data)).handler(async ({ data }) => {
  const context = await requireAuthContext();
  const job = (await readData()).aiJobs.find((j) => j.id === data.attemptId && j.type === "campaign" && j.workspaceId === context.workspace.id && j.input.userId === context.user.id && ownsBrand(context, j.brandId));
  if (!job) throw new Error("A generálási kísérlet nem található.");
  const db = await readData();
  const legacy = db.campaigns.find((c) => c.id === job.input.campaignId && c.workspaceId === context.workspace.id && c.brandId === job.brandId);
  return createCampaignPlan(CampaignInputSchema.parse({ ...job.input, requestId: undefined }), job.input.days === 7 ? 7 : 30, legacy?.id, legacy ? undefined : job.id);
});

async function createCampaignPlan(
  data: z.infer<typeof CampaignInputSchema>,
  days: 7 | 30,
  existingId?: string,
  attemptId?: string,
) {
  if (data.endDate < data.startDate)
    throw new Error("A kampány záró dátuma nem lehet a kezdő dátum előtt.");
  if (data.endDate < addDays(data.startDate, days - 1))
    throw new Error("A kampány időtartama túl rövid a kért tervhez.");
  const context = await requireAuthContext();
  const attempt = attemptId ? (await readData()).aiJobs.find((j) => j.id === attemptId && j.type === "campaign" && j.workspaceId === context.workspace.id && j.input.userId === context.user.id && ownsBrand(context, j.brandId)) : null;
  if (attemptId && !attempt) throw new Error("A generálási kísérlet nem található.");
  if (attempt) { data = CampaignInputSchema.parse({ ...attempt.input, requestId: undefined }); days = attempt.input.days === 7 ? 7 : 30; }
  const existing = existingId ? findCampaign(await readData(), context, existingId) : null;
  if (existing) {
    data = CampaignInputSchema.parse(existing);
    days = planDuration(existing);
  }
  const brand = existing
    ? context.brands.find((item) => item.id === existing.brandId)
    : attempt ? context.brands.find((b) => b.id === attempt.brandId) : context.activeBrand;
  if (!brand) throw new Error("Aktív márka szükséges a kampány indításához.");
  const businessContext = buildBusinessContext(brand, brand.profile, {
    goal: data.objective,
    audience: data.audience || brand.audience,
    language: brand.languageMarket,
    platform: data.channels.join(", "),
  });
  const { campaign, job, savedWeeks } = await transact((database) => {
    const attemptJob = attempt ? database.aiJobs.find((j) => j.id === attempt.id && j.input.userId === context.user.id && j.workspaceId === context.workspace.id) : null;
    if (attempt && (!attemptJob || attemptJob.status === "completed" || campaignJobRunning(attemptJob))) throw new Error("Ez a generálás már fut vagy elkészült. Frissítsd az oldalt.");
    if (!database.brands.some((b) => b.id === brand.id && b.workspaceId === context.workspace.id)) throw new Error("A márka időközben megszűnt.");
    if (
      data.requestId &&
      database.aiJobs.some(
        (job) => job.workspaceId === context.workspace.id && job.input.requestId === data.requestId,
      )
    )
      throw new Error("Ez a kérés már elindult. A kampánylistában ellenőrizheted az állapotát.");
    const timestamp = nowIso();
    const current = existingId ? findCampaign(database, context, existingId) : null;
    const previousJobs = current ? campaignJobs(current, database.aiJobs) : [];
    if (previousJobs.some((job) => campaignJobRunning(job)))
      throw new Error("A kampányon már dolgozik az AI. Várd meg az eredményt.");
    if (
      current &&
      (current.updatedAt !== existing?.updatedAt ||
        current.strategy ||
        database.planItems.some(
          (item) =>
            item.campaignId === current.id &&
            item.workspaceId === current.workspaceId &&
            item.brandId === current.brandId,
        ))
    )
      throw new Error(
        "A kampány már elkészült vagy közben megváltozott. Frissítsd az oldalt; a meglévő tartalmakat nem írjuk felül.",
      );
    const pendingCampaign = attemptJob?.input.pendingCampaign as CampaignRecord | undefined;
    const created: CampaignRecord = current ?? pendingCampaign ?? {
      id: newId("campaign"),
      workspaceId: context.workspace.id,
      brandId: brand.id,
      name: uniqueCampaignName(
        data.name,
        database.campaigns
          .filter((item) => item.workspaceId === context.workspace.id && item.brandId === brand.id)
          .map((item) => item.name),
      ),
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
    const savedWeeks = resumableCampaignWeeks(created, attemptJob?.input ?? previousJobs[0]?.input ?? {});
    created.status = "planning";
    created.updatedAt = timestamp;
    const input = {
        pendingCampaign: created,
        businessContext,
        workspace: context.workspace.name,
        campaignId: created.id,
        days,
        totalWeeks: campaignWeeks(data.startDate, days).length,
        completedWeeks: savedWeeks.length,
        weekPlans: savedWeeks,
        userId: context.user.id,
        ...data,
        brandVoice: brand.profile,
        brand: { name: brand.name, industry: brand.industry, products: brand.products, services: brand.services, offers: brand.offers, audience: brand.audience, cityRegion: brand.cityRegion, languageMarket: brand.languageMarket },
    };
    const job = attemptJob ?? createAiJob(database, {
      workspaceId: context.workspace.id,
      brandId: brand.id,
      type: "campaign",
      input,
    });
    job.input = input;
    job.error = undefined;
    job.createdAt = timestamp;
    job.completedAt = undefined;
    startAiJob(database, job.id);
    return { campaign: created, job, savedWeeks };
  });
  try {
    const weekPlans: WeekPlan[] = [...savedWeeks];
    const plannedTopics: string[] = savedWeeks.flatMap((plan) => [
      ...plan.temak_osszefoglalo,
      ...plan.posztok.map((item) => item.tema),
    ]);
    const channelCounts: Record<string, number> = {};
    for (const plan of savedWeeks)
      for (const item of plan.posztok)
        channelCounts[item.csatorna] = (channelCounts[item.csatorna] ?? 0) + 1;
    const weeks = campaignWeeks(data.startDate, days);
    // Finish before the Vercel server budget so failure/partial results can be persisted.
    const deadlineAt = Date.now() + 240_000;
    for (const week of weeks) {
      if (weekPlans.some((plan) => plan.het === week.week)) continue;
      let plan;
      try {
        plan = await generateWeeklyPlan({
          businessContext,
          campaign: { ...data, audience: data.audience || brand.audience },
          channels: data.channels,
          week,
          plannedTopics,
          channelCounts,
          localEvents: localMarketEvents(week.startDate, week.endDate, businessContext.localEvents)
            .map((event) => `${event.date} — ${event.name}`),
          weekly: days === 7,
          deadlineAt,
        });
      } catch (cause) {
        throw new Error(
          `A(z) ${week.week}. hét tervezése nem sikerült. ${week.week > 1 ? "Az előző hetek ellenőrzött piszkozata megmaradt; a naptárba csak a teljes terv kerül. " : ""}${cause instanceof Error ? cause.message : "Próbáld újra."}`,
        );
      }
      await transact((database) => {
        const timestamp = nowIso();
        const current = database.campaigns.find((c) => c.id === campaign.id && c.workspaceId === context.workspace.id && c.brandId === brand.id);
        if (current) current.updatedAt = timestamp;
        const currentJob = database.aiJobs.find(
          (item) => item.id === job.id && item.workspaceId === context.workspace.id,
        );
        if (!currentJob || !database.users.some((u) => u.id === context.user.id && !u.auth?.deleting)) throw new Error("A generálás megszakadt, a fiók már nem aktív.");
        if (currentJob)
          currentJob.input = {
            ...currentJob.input,
            completedWeeks: weekPlans.length + 1,
            weekPlans: [...weekPlans, plan],
            totalWeeks: weeks.length,
            plannedTopics: [
              ...plannedTopics,
              ...plan.temak_osszefoglalo,
              ...plan.posztok.map((item) => item.tema),
            ],
          };
      });
      weekPlans.push(plan);
      plannedTopics.push(...plan.temak_osszefoglalo, ...plan.posztok.map((item) => item.tema));
      for (const item of plan.posztok)
        channelCounts[item.csatorna] = (channelCounts[item.csatorna] ?? 0) + 1;
    }
    const saved = await transact((database) => {
      if (!database.aiJobs.some((j) => j.id === job.id) || !database.brands.some((b) => b.id === brand.id && b.workspaceId === context.workspace.id) || !database.users.some((u) => u.id === context.user.id && !u.auth?.deleting)) throw new Error("A generálás megszakadt, a márka vagy a fiók már nem aktív.");
      let current = database.campaigns.find((c) => c.id === campaign.id && c.workspaceId === context.workspace.id && c.brandId === brand.id);
      if (!current) {
        current = { ...campaign, name: uniqueCampaignName(data.name, database.campaigns.filter((c) => c.workspaceId === context.workspace.id && c.brandId === brand.id).map((c) => c.name)) };
        database.campaigns.push(current);
      }
      applyCompleteCampaignWeeks(database, current, weekPlans);
      completeAiJob(database, job.id);
      return current.id;
    });
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
      completeAiJob(
        database,
        job.id,
        cause instanceof Error ? cause.message : "AI kampányterv hiba",
      );
    });
    throw cause;
  }
}

export const updateCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => CampaignUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const result = await transact((database) => {
      const campaign = findCampaign(database, context, data.campaignId);
      if (campaignJobs(campaign, database.aiJobs).some((job) => campaignJobRunning(job)))
        throw new Error("A kampányon már dolgozik az AI. A szerkesztéssel várd meg az eredményt.");
      const nextStart = data.startDate ?? campaign.startDate;
      const nextEnd = data.endDate ?? campaign.endDate;
      if (nextEnd < nextStart)
        throw new Error("A kampány záró dátuma nem lehet a kezdő dátum előtt.");
      if (nextEnd < addDays(nextStart, campaign.endDate < addDays(campaign.startDate, 29) ? 6 : 29))
        throw new Error("A kampány időtartama túl rövid a meglévő tervhez.");
      const { campaignId: _campaignId, ...fields } = data;
      if (fields.name !== undefined)
        fields.name = uniqueCampaignName(
          fields.name,
          database.campaigns
            .filter(
              (item) =>
                item.id !== campaign.id &&
                item.workspaceId === campaign.workspaceId &&
                item.brandId === campaign.brandId,
            )
            .map((item) => item.name),
        );
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
      if (finalStatus === "scheduled") {
        const linkedVariants = item.postId
          ? database.postVariants.filter((variant) => variant.postId === item.postId)
          : [];
        if (item.postId && !linkedVariants.length)
          throw new Error("Az ütemezéshez előbb készíts platformváltozatot.");
        assertContentReady(
          ...(linkedVariants.length
            ? linkedVariants.flatMap((variant) => [
                variant.content,
                variant.cta,
                ...variant.hashtags,
              ])
            : [item.draftContent, item.topic]),
        );
      }
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
      if (contentContextChanged) {
        item.draftContent = "";
        item.visualIdea = "";
        item.verificationWarnings = [];
        item.topicSummary = "";
      }
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
    const user = `Kampány: ${campaign?.name ?? "Önálló tervtétel"}\nKampány célja: ${campaign?.objective ?? item.objective}\nKampány közönsége: ${campaign?.audience ?? brand.audience}\nKampány ajánlata: ${campaign?.offer ?? brand.offers}\nKampány leírása: ${campaign?.description ?? ""}\nKampány stratégiai összefoglaló: ${campaign?.strategy?.summary ?? ""}\nFő üzenet: ${campaign?.strategy?.mainMessage ?? ""}\nTervtétel dátuma: ${item.date}\nPlatform: ${item.platform}\nTartalomtípus: ${item.contentType}\nTéma: ${item.topic}\nTervtétel célja: ${item.objective}\nJóváhagyandó tervvázlat: ${item.draftContent ?? ""}\nEllenőrizendő: ${(item.verificationWarnings ?? []).join(", ")}\nKampány CTA: ${campaign?.cta ?? brand.profile.ctaStyle}`;
    const generated = await generateFactualPost({
      businessContext,
      brief: `Téma: ${item.topic}. Tartalomtípus: ${item.contentType}. Cél: ${item.objective}.`,
      title: item.topic,
      platforms: [item.platform],
      ctaStyle: campaign?.cta || brand.profile.ctaStyle,
      campaignContext: user,
    });
    const variant = generated.variants[0];
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
          verificationWarnings: variant.ellenorizendo,
          content: variant.content,
          hashtags: variant.hashtags,
          cta: variant.cta,
          status: contentPlaceholders(variant.content, variant.cta, ...variant.hashtags).length
            ? "draft"
            : "prepared",
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
            verificationWarnings: variant.ellenorizendo,
            content: variant.content,
            hashtags: variant.hashtags,
            cta: variant.cta,
            status: contentPlaceholders(variant.content, variant.cta, ...variant.hashtags).length
              ? ("draft" as const)
              : ("prepared" as const),
            updatedAt: timestamp,
          });
        } else
          database.postVariants.push({
            id: newId("variant"),
            postId: post.id,
            platform: currentItem.platform,
            verificationWarnings: variant.ellenorizendo,
            content: variant.content,
            hashtags: variant.hashtags,
            cta: variant.cta,
            status: contentPlaceholders(variant.content, variant.cta, ...variant.hashtags).length
              ? "draft"
              : "prepared",
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

export const getCampaignGenerationProgress = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ requestId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const db = await readData();
    const job = db.aiJobs.find(
      (j) =>
        j.workspaceId === context.workspace.id &&
        j.input.requestId === data.requestId &&
        j.input.userId === context.user.id &&
        ownsBrand(context, j.brandId),
    );
    if (!job) return null;
    return {
      status: job.status,
      completedWeeks: storedCampaignWeeks(job.input).length,
      totalWeeks: Number(job.input.totalWeeks) || 5,
      error: job.error ?? null,
    };
  });

export const getCampaignWeekDrafts = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ campaignId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const db = await readData();
    const campaign = findCampaign(db, context, data.campaignId);
    const jobs = db.aiJobs
      .filter(
        (j) =>
          j.workspaceId === context.workspace.id &&
          j.brandId === campaign.brandId &&
          j.input.campaignId === campaign.id,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      weeks: campaignWeeks(campaign.startDate, planDuration(campaign)),
      plans: storedCampaignWeeks(jobs[0]?.input ?? {}),
      running: jobs.some(
        (j) => j.status === "running" && Date.now() - Date.parse(j.createdAt) < 300000,
      ),
    };
  });

export const regenerateCampaignWeek = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ campaignId: z.string().min(1), week: z.number().int().min(1).max(5) }).parse(data),
  )
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const reserved = await transact((db) => {
      const campaign = findCampaign(db, context, data.campaignId);
      const brand = context.brands.find((b) => b.id === campaign.brandId)!;
      const week = campaignWeeks(campaign.startDate, planDuration(campaign)).find(
        (w) => w.week === data.week,
      );
      if (!week) throw new Error("Ez a hét nem része a kampánynak.");
      const jobs = db.aiJobs
        .filter(
          (j) =>
            j.workspaceId === context.workspace.id &&
            j.brandId === brand.id &&
            j.input.campaignId === campaign.id,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (jobs.some((j) => j.status === "running" && Date.now() - Date.parse(j.createdAt) < 300000))
        throw new Error("A kampányon már dolgozik az AI. Várd meg az eredményt.");
      const items = db.planItems.filter(
        (p) =>
          p.workspaceId === context.workspace.id &&
          p.brandId === brand.id &&
          p.campaignId === campaign.id &&
          p.date >= week.startDate &&
          p.date <= week.endDate,
      );
      if (items.some((p) => p.postId || ["ready", "scheduled", "published"].includes(p.status)))
        throw new Error(
          "Ehhez a héthez már jóváhagyott, ütemezett vagy elkészített poszt tartozik. A posztot külön szerkesztheted.",
        );
      const plans = storedCampaignWeeks(jobs[0]?.input ?? {});
      const job = createAiJob(db, {
        workspaceId: context.workspace.id,
        brandId: brand.id,
        type: "campaign",
        input: {
          campaignId: campaign.id,
          weekPlans: plans,
          totalWeeks: campaignWeeks(campaign.startDate, planDuration(campaign)).length,
          regeneratingWeek: data.week,
          userId: context.user.id,
        },
      });
      startAiJob(db, job.id);
      return {
        campaign,
        brand,
        week,
        plans,
        jobId: job.id,
        itemsFingerprint: JSON.stringify(items),
      };
    });
    try {
      const businessContext = buildBusinessContext(reserved.brand, reserved.brand.profile, {
        goal: reserved.campaign.objective,
        audience: reserved.campaign.audience,
        platform: reserved.campaign.channels.join(", "),
      });
      const otherPlans = reserved.plans.filter((p) => p.het !== data.week);
      const db = await readData();
      const otherItems = db.planItems.filter(
        (p) =>
          p.workspaceId === context.workspace.id &&
          p.brandId === reserved.brand.id &&
          p.campaignId === reserved.campaign.id &&
          (p.date < reserved.week.startDate || p.date > reserved.week.endDate),
      );
      const plan = await generateWeeklyPlan({
        businessContext,
        campaign: reserved.campaign,
        channels: reserved.campaign.channels,
        week: reserved.week,
        plannedTopics: [
          ...otherPlans.flatMap((p) => p.temak_osszefoglalo),
          ...otherItems.map((p) => p.topicSummary || p.topic),
        ],
        channelCounts: {},
        localEvents: localMarketEvents(reserved.week.startDate, reserved.week.endDate, businessContext.localEvents)
          .map((event) => `${event.date} — ${event.name}`),
        weekly: planDuration(reserved.campaign) === 7,
      });
      await transact((database) => {
        const current = findCampaign(database, context, reserved.campaign.id);
        const items = database.planItems.filter(
          (p) =>
            p.workspaceId === context.workspace.id &&
            p.brandId === reserved.brand.id &&
            p.campaignId === current.id &&
            p.date >= reserved.week.startDate &&
            p.date <= reserved.week.endDate,
        );
        if (
          current.updatedAt !== reserved.campaign.updatedAt ||
          JSON.stringify(items) !== reserved.itemsFingerprint
        )
          throw new Error(
            "A terv közben megváltozott. Nem írtuk felül a módosításaidat; próbáld újra.",
          );
        const plans = [...otherPlans, plan].sort((a, b) => a.het - b.het);
        const job = database.aiJobs.find(
          (j) => j.id === reserved.jobId && j.workspaceId === context.workspace.id,
        )!;
        job.input = { ...job.input, weekPlans: plans, completedWeeks: plans.length };
        const expected = campaignWeeks(current.startDate, planDuration(current)).length;
        if (plans.length === expected || current.strategy) {
          const ids = new Set(items.map((p) => p.id));
          database.planItems = database.planItems.filter((p) => !ids.has(p.id));
          applyCompleteCampaignWeeks(database, current, plans, !!current.strategy);
        }
        completeAiJob(database, job.id);
      });
      return { week: plan.het };
    } catch (error) {
      await transact((db) =>
        completeAiJob(
          db,
          reserved.jobId,
          error instanceof Error ? error.message : "A hét generálása nem sikerült.",
        ),
      );
      throw error;
    }
  });
