import type { AppData } from "@/lib/data-model";
import { getWorkspaceSnapshot } from "@/lib/server/store.server";

export type LocalAdminConfiguration = {
  nodeEnv?: string;
  enabled?: string;
  userId?: string;
  workspaceId?: string;
};

export function localAdminConfiguration(): LocalAdminConfiguration {
  return {
    nodeEnv: process.env.NODE_ENV,
    enabled: process.env.ENABLE_LOCAL_ADMIN_LOGIN,
    userId: process.env.LOCAL_ADMIN_USER_ID,
    workspaceId: process.env.LOCAL_ADMIN_WORKSPACE_ID,
  };
}

/** Explicit opt-in on loopback development only; never accept proxy origins. */
export function isLocalAdminRequest(request: Request, config: LocalAdminConfiguration) {
  if (
    config.nodeEnv !== "development" ||
    config.enabled !== "true" ||
    !config.userId ||
    !config.workspaceId
  )
    return false;
  try {
    const url = new URL(request.url);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password
    )
      return false;
    if (
      ["forwarded", "x-forwarded-host", "x-forwarded-for", "x-forwarded-proto"].some((name) =>
        request.headers.has(name),
      )
    )
      return false;
    const origin = request.headers.get("origin");
    if (request.method !== "GET" && !origin) return false;
    if (origin && new URL(origin).origin !== url.origin) return false;
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && !["same-origin", "none"].includes(fetchSite)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Use only the configured existing owner/admin membership. Never elevate roles. */
export function localAdminSnapshot(database: AppData, config: LocalAdminConfiguration) {
  if (!config.userId || !config.workspaceId) return null;
  const membership = database.memberships.find(
    (item) =>
      item.userId === config.userId &&
      item.workspaceId === config.workspaceId &&
      (item.role === "owner" || item.role === "admin"),
  );
  return membership ? getWorkspaceSnapshot(database, config.userId, config.workspaceId) : null;
}
