import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AnalyticsSnapshotRecord, PostPlatform } from "@/lib/data-model";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import { newId, nowIso, readData, transact } from "@/lib/server/store.server";

const platforms = ["facebook", "instagram", "tiktok", "linkedin", "youtube", "google-business"] as const;
const sources = [...platforms, "import"] as const;
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Érvénytelen mérési dátum.");
const metricSchema = z.number().int().nonnegative().nullable().default(null);
const rangeSchema = z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30), brandId: z.string().min(1).optional() });
const snapshotSchema = z.object({
  brandId: z.string().min(1),
  platform: z.enum(platforms),
  postId: z.string().min(1).nullable().default(null),
  date: dateSchema,
  impressions: metricSchema,
  reach: metricSchema,
  engagement: metricSchema,
  clicks: metricSchema,
  likes: metricSchema,
  comments: metricSchema,
  shares: metricSchema,
  saves: metricSchema,
  videoViews: metricSchema,
  source: z.enum(sources).default("import"),
});

export type AnalyticsDays = 7 | 30 | 90;
export type AnalyticsMetric = "impressions" | "reach" | "engagement" | "clicks" | "likes" | "comments" | "shares" | "saves" | "videoViews";
export const ANALYTICS_METRICS: AnalyticsMetric[] = ["impressions", "reach", "engagement", "clicks", "likes", "comments", "shares", "saves", "videoViews"];

export type AnalyticsResult = {
  days: AnalyticsDays;
  brandId: string | null;
  dateFrom: string;
  dateTo: string;
  snapshots: AnalyticsSnapshotRecord[];
  totals: Record<AnalyticsMetric, number>;
  byPlatform: Array<{ platform: PostPlatform; snapshots: number; totals: Record<AnalyticsMetric, number> }>;
  dataSource: { snapshotCount: number; platforms: PostPlatform[]; hasData: boolean };
};

function dateWindow(days: AnalyticsDays) {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
}

function emptyTotals(): Record<AnalyticsMetric, number> {
  return Object.fromEntries(ANALYTICS_METRICS.map((metric) => [metric, 0])) as Record<AnalyticsMetric, number>;
}

function addTotals(target: Record<AnalyticsMetric, number>, snapshot: AnalyticsSnapshotRecord) {
  for (const metric of ANALYTICS_METRICS) target[metric] += snapshot[metric] ?? 0;
}

async function getAnalyticsData(days: AnalyticsDays, brandId: string | null): Promise<AnalyticsResult> {
  const context = await requireAuthContext();
  const database = await readData();
  const resolvedBrandId = brandId ?? context.activeBrand?.id ?? null;
  if (resolvedBrandId && !context.brands.some((brand) => brand.id === resolvedBrandId)) throw new Error("Nincs hozzáférés ehhez a márkához.");
  const { dateFrom, dateTo } = dateWindow(days);
  const snapshots = resolvedBrandId ? database.analyticsSnapshots.filter((snapshot) => snapshot.workspaceId === context.workspace.id && snapshot.brandId === resolvedBrandId && snapshot.date >= dateFrom && snapshot.date <= dateTo) : [];
  const totals = emptyTotals(); snapshots.forEach((snapshot) => addTotals(totals, snapshot));
  const byPlatform = platforms.map((platform) => {
    const platformSnapshots = snapshots.filter((snapshot) => snapshot.platform === platform);
    const platformTotals = emptyTotals(); platformSnapshots.forEach((snapshot) => addTotals(platformTotals, snapshot));
    return { platform, snapshots: platformSnapshots.length, totals: platformTotals };
  }).filter((entry) => entry.snapshots > 0);
  return { days, brandId: resolvedBrandId, dateFrom, dateTo, snapshots, totals, byPlatform, dataSource: { snapshotCount: snapshots.length, platforms: [...new Set(snapshots.map((snapshot) => snapshot.platform))], hasData: snapshots.length > 0 } };
}

export const getAnalytics = createServerFn({ method: "GET" }).inputValidator((data: unknown) => rangeSchema.parse(data)).handler(async ({ data }) => getAnalyticsData(data.days, data.brandId ?? null));

/**
 * Server-side ingestion point for future social API synchronizers. It is
 * ownership checked and upserts one provider snapshot without exposing any
 * credential or accepting a cross-workspace post reference.
 */
export const upsertAnalyticsSnapshot = createServerFn({ method: "POST" }).inputValidator((data: unknown) => snapshotSchema.parse(data)).handler(async ({ data }) => {
  const context = await requireAuthContext();
  if (!context.brands.some((brand) => brand.id === data.brandId)) throw new Error("Nincs hozzáférés ehhez a márkához.");
  await transact((database) => {
    if (data.postId && !database.posts.some((post) => post.id === data.postId && post.workspaceId === context.workspace.id && post.brandId === data.brandId)) throw new Error("A méréshez kapcsolt poszt nem ehhez a márkához tartozik.");
    const timestamp = nowIso();
    const existing = database.analyticsSnapshots.find((snapshot) => snapshot.workspaceId === context.workspace.id && snapshot.brandId === data.brandId && snapshot.platform === data.platform && snapshot.postId === data.postId && snapshot.date === data.date && snapshot.source === data.source);
    const { brandId, ...fields } = data;
    if (existing) Object.assign(existing, fields, { updatedAt: timestamp });
    else database.analyticsSnapshots.push({ id: newId("metric"), workspaceId: context.workspace.id, brandId, ...fields, createdAt: timestamp, updatedAt: timestamp });
  });
  return getAnalyticsData(30, data.brandId);
});
