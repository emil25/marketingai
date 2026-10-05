import type {
  ChannelConnectionRecord,
  PlanItemRecord,
  PostRecord,
  PostVariantRecord,
} from "./data-model";

type BrandScoped = { workspaceId: string; brandId: string };
type ChannelSummary = Pick<
  ChannelConnectionRecord,
  "provider" | "status" | "externalAccountId" | "tokenExpiresAt"
> & { hasAccessToken: boolean };
type PlannedPost = Pick<PostRecord, "id" | "workspaceId" | "brandId" | "status"> & {
  variants: Array<Pick<PostVariantRecord, "postId" | "platform" | "content" | "status">>;
};

export function activeBrandRecords<T extends BrandScoped>(
  records: T[],
  workspaceId: string,
  brandId?: string | null,
): T[] {
  return brandId
    ? records.filter((record) => record.workspaceId === workspaceId && record.brandId === brandId)
    : [];
}

export function isChannelConnected(connection?: ChannelSummary, now = Date.now()): boolean {
  if (
    !connection ||
    connection.status !== "connected" ||
    !connection.hasAccessToken ||
    !connection.externalAccountId
  )
    return false;
  if (!connection.tokenExpiresAt) return true;
  const expiresAt = Date.parse(connection.tokenExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function connectedChannelCount(connections: ChannelSummary[], now = Date.now()): number {
  return new Set(
    connections
      .filter((connection) => isChannelConnected(connection, now))
      .map((connection) => connection.provider),
  ).size;
}

function localDateKey(now: Date, timezone: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en", {
      timeZone: "Europe/Bucharest",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  }
  const part = (name: string) => parts.find((item) => item.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function weeklyPlanItems<
  T extends Pick<PlanItemRecord, "date" | "time" | "timezone" | "status">,
>(items: T[], now = new Date()): T[] {
  return items
    .filter((item) => {
      if (item.status === "skipped" || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) return false;
      const date = new Date(`${item.date}T00:00:00.000Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== item.date)
        return false;
      const today = localDateKey(now, item.timezone);
      const end = new Date(`${today}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 7);
      return item.date >= today && item.date < end.toISOString().slice(0, 10);
    })
    .sort((a, b) => `${a.date} ${a.time ?? ""}`.localeCompare(`${b.date} ${b.time ?? ""}`));
}

export function hasPlannedPostContent(
  item: Pick<PlanItemRecord, "workspaceId" | "brandId" | "postId" | "platform">,
  posts: PlannedPost[],
): boolean {
  const post = posts.find(
    (candidate) =>
      candidate.id === item.postId &&
      candidate.workspaceId === item.workspaceId &&
      candidate.brandId === item.brandId,
  );
  return Boolean(
    post &&
    !["idea", "failed"].includes(post.status) &&
    post.variants.some(
      (variant) =>
        variant.postId === post.id &&
        variant.platform === item.platform &&
        variant.status !== "failed" &&
        variant.content.trim().length > 0,
    ),
  );
}
