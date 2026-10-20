import type { AppData } from "../data-model";

/** Match PostgreSQL's parent checks for newly created JSON fixture records too.
 * Existing legacy rows are not silently rewritten or discarded. */
export function captureRecordIds(data: AppData) {
  return new Map(
    Object.entries(data).map(([key, rows]) => [
      key,
      new Set((rows as { id: string }[]).map((row) => row.id)),
    ]),
  );
}
export function assertNewRecordParents(data: AppData, before: ReturnType<typeof captureRecordIds>) {
  const users = new Map(data.users.map((row) => [row.id, row]));
  const workspaces = new Set(data.workspaces.map((row) => row.id));
  const brands = new Map(data.brands.map((row) => [row.id, row]));
  const posts = new Map(data.posts.map((row) => [row.id, row]));
  const campaigns = new Map(data.campaigns.map((row) => [row.id, row]));
  const denied = () => {
    throw new Error(
      "A mentés nem sikerült: a kapcsolódó vállalkozás vagy tartalom már nem érhető el.",
    );
  };
  for (const [key, rows] of Object.entries(data)) {
    for (const row of rows as Array<{
      id: string;
      workspaceId?: string;
      brandId?: string;
      postId?: string | null;
      campaignId?: string | null;
      userId?: string;
      input?: Record<string, unknown>;
    }>) {
      if (before.get(key)?.has(row.id)) continue;
      if (row.workspaceId && !workspaces.has(row.workspaceId)) denied();
      if (
        row.brandId &&
        (!brands.has(row.brandId) ||
          (row.workspaceId && brands.get(row.brandId)?.workspaceId !== row.workspaceId))
      )
        denied();
      if (
        row.postId &&
        (!posts.has(row.postId) ||
          (row.workspaceId && posts.get(row.postId)?.workspaceId !== row.workspaceId) ||
          (row.brandId && posts.get(row.postId)?.brandId !== row.brandId))
      )
        denied();
      if (
        row.campaignId &&
        (!campaigns.has(row.campaignId) ||
          (row.workspaceId && campaigns.get(row.campaignId)?.workspaceId !== row.workspaceId) ||
          (row.brandId && campaigns.get(row.campaignId)?.brandId !== row.brandId))
      )
        denied();
      const userId =
        row.userId ??
        (key === "aiJobs" && typeof row.input?.userId === "string" ? row.input.userId : undefined);
      if (userId && (!users.has(userId) || users.get(userId)?.auth?.deleting)) denied();
      if (row.workspaceId && key !== "memberships") {
        const members = data.memberships.filter((member) => member.workspaceId === row.workspaceId);
        if (
          members.length &&
          !members.some(
            (member) => users.has(member.userId) && !users.get(member.userId)?.auth?.deleting,
          )
        )
          denied();
      }
    }
  }
}
