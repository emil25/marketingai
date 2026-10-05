import { z } from "zod";
import type {
  ChannelConnectionRecord,
  ChannelConnectionStatus,
  ChannelOAuthSelectionCandidate,
  ChannelProvider,
} from "@/lib/data-model";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import { encryptToken } from "@/lib/server/token-crypto.server";
import { newId, nowIso, readData, transact } from "@/lib/server/store.server";

const META_PROVIDERS = new Set<ChannelProvider>(["facebook", "instagram"]);
const META_VERSION_PATTERN = /^v\d+\.\d+$/;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
];

export type MetaErrorCode =
  | "config"
  | "state"
  | "cancelled"
  | "no_page"
  | "no_instagram"
  | "selection"
  | "provider"
  | "unexpected";

export class MetaOAuthError extends Error {
  constructor(
    readonly code: MetaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MetaOAuthError";
  }
}

function metaVersion() {
  const value = process.env["META_GRAPH_VERSION"] || "v26.0";
  if (!META_VERSION_PATTERN.test(value))
    throw new MetaOAuthError("config", "A META_GRAPH_VERSION értéke érvénytelen.");
  return value;
}

function metaRedirectUri() {
  const value = process.env["META_REDIRECT_URI"];
  if (!value) throw new MetaOAuthError("config", "A META_REDIRECT_URI nincs beállítva.");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new MetaOAuthError("config", "A META_REDIRECT_URI értéke érvénytelen.");
  }
  if (
    !/^https?:$/.test(parsed.protocol) ||
    !parsed.pathname.endsWith("/api/channels/oauth-callback")
  )
    throw new MetaOAuthError(
      "config",
      "A META_REDIRECT_URI nem a biztonságos callback útvonalra mutat.",
    );
  return value;
}

function metaConfig() {
  const appId = process.env["META_APP_ID"];
  const appSecret = process.env["META_APP_SECRET"];
  if (!appId || !appSecret)
    throw new MetaOAuthError("config", "A Meta alkalmazás azonosítói nincsenek beállítva.");
  const redirectUri = metaRedirectUri();
  const scopes = (process.env["META_OAUTH_SCOPES"] || DEFAULT_META_SCOPES.join(","))
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (!scopes.length || scopes.some((scope) => !/^[a-z0-9_]+$/i.test(scope)))
    throw new MetaOAuthError("config", "A Meta OAuth scope-listája érvénytelen.");
  return { appId, appSecret, redirectUri, scopes, version: metaVersion() };
}

function cryptoRandomBytes(size: number) {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

export async function prepareMetaOAuth(provider: "facebook" | "instagram") {
  if (!META_PROVIDERS.has(provider))
    throw new MetaOAuthError("config", "Ehhez a csatornához még nincs Meta OAuth adapter.");
  const context = await requireAuthContext();
  if (!context.activeBrand)
    throw new MetaOAuthError("config", "Előbb hozz létre és válassz ki egy aktív márkát.");
  const config = metaConfig();
  const state = Buffer.from(cryptoRandomBytes(32)).toString("base64url");
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();
  const connectionId = await transact((database) => {
    database.channelOAuthStates = database.channelOAuthStates.filter(
      (candidate) =>
        candidate.expiresAt > createdAt &&
        !(
          candidate.userId === context.user.id &&
          candidate.workspaceId === context.workspace.id &&
          candidate.brandId === context.activeBrand!.id &&
          candidate.provider === provider
        ),
    );
    database.channelOAuthSelections = database.channelOAuthSelections.filter(
      (candidate) =>
        !(
          candidate.userId === context.user.id &&
          candidate.workspaceId === context.workspace.id &&
          candidate.brandId === context.activeBrand!.id &&
          candidate.provider === provider
        ),
    );
    const existing = database.channelConnections.find(
      (candidate) =>
        candidate.workspaceId === context.workspace.id &&
        candidate.brandId === context.activeBrand!.id &&
        candidate.provider === provider,
    );
    const id = existing?.id ?? newId("channel");
    if (existing) {
      existing.status = "connecting";
      existing.lastError = null;
      existing.updatedAt = createdAt;
    } else
      database.channelConnections.push({
        id,
        workspaceId: context.workspace.id,
        brandId: context.activeBrand!.id,
        provider,
        status: "connecting",
        externalAccountId: null,
        externalAccountName: null,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
        scopes: [],
        connectedAt: null,
        updatedAt: createdAt,
        lastError: null,
      });
    database.channelOAuthStates.push({
      state,
      userId: context.user.id,
      workspaceId: context.workspace.id,
      brandId: context.activeBrand!.id,
      provider,
      connectionId: id,
      createdAt,
      expiresAt,
    });
    return id;
  });
  const authorization = new URL(`https://www.facebook.com/${config.version}/dialog/oauth`);
  authorization.searchParams.set("client_id", config.appId);
  authorization.searchParams.set("redirect_uri", config.redirectUri);
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", config.scopes.join(","));
  return { authorizationUrl: authorization.toString(), connectionId };
}

async function consumeOAuthState(state: string) {
  return transact((database) => {
    const now = Date.now();
    database.channelOAuthStates = database.channelOAuthStates.filter(
      (candidate) => Date.parse(candidate.expiresAt) > now,
    );
    const found = database.channelOAuthStates.find((candidate) => candidate.state === state);
    if (!found) return null;
    database.channelOAuthStates = database.channelOAuthStates.filter(
      (candidate) => candidate.state !== state,
    );
    return found;
  });
}

async function setConnectionError(
  state: Awaited<ReturnType<typeof consumeOAuthState>>,
  status: ChannelConnectionStatus,
  message: string,
) {
  if (!state) return;
  await transact((database) => {
    const connection = database.channelConnections.find(
      (candidate) =>
        candidate.id === state.connectionId &&
        candidate.workspaceId === state.workspaceId &&
        candidate.brandId === state.brandId &&
        candidate.provider === state.provider,
    );
    if (!connection) return;
    connection.status = status;
    connection.lastError = message.slice(0, 500);
    connection.updatedAt = nowIso();
  });
}

export async function handleMetaOAuthCallback(url: URL) {
  const stateValue = url.searchParams.get("state");
  const state = stateValue ? await consumeOAuthState(stateValue) : null;
  if (!state) throw new MetaOAuthError("state", "Az OAuth munkamenet érvénytelen vagy lejárt.");
  if (url.searchParams.get("error") || url.searchParams.get("error_reason")) {
    await setConnectionError(state, "not_connected", "A Meta-kapcsolást megszakítottad.");
    throw new MetaOAuthError("cancelled", "A Meta-kapcsolást megszakítottad.");
  }
  const code = url.searchParams.get("code");
  if (!code) {
    await setConnectionError(state, "error", "A Meta nem adott vissza érvényes engedélykódot.");
    throw new MetaOAuthError("provider", "A Meta nem adott vissza érvényes engedélykódot.");
  }
  const context = await requireAuthContext();
  if (
    context.user.id !== state.userId ||
    context.workspace.id !== state.workspaceId ||
    context.activeBrand?.id !== state.brandId
  ) {
    await setConnectionError(
      state,
      "error",
      "Az OAuth munkamenet nem ehhez a munkatérhez tartozik.",
    );
    throw new MetaOAuthError("state", "Az OAuth munkamenet nem ehhez a munkatérhez tartozik.");
  }
  try {
    const result = await completeMetaConnection(state.provider, code);
    if (result.candidates.length > 1) {
      const selectionId = newId("channel-selection");
      await transact((database) => {
        const connection = database.channelConnections.find(
          (candidate) =>
            candidate.id === state.connectionId &&
            candidate.workspaceId === state.workspaceId &&
            candidate.brandId === state.brandId &&
            candidate.provider === state.provider,
        );
        if (!connection)
          throw new MetaOAuthError("unexpected", "A csatornakapcsolat nem található.");
        database.channelOAuthSelections.push({
          id: selectionId,
          userId: state.userId,
          workspaceId: state.workspaceId,
          brandId: state.brandId,
          provider: state.provider,
          connectionId: state.connectionId,
          candidates: result.candidates,
          createdAt: nowIso(),
          expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString(),
        });
        connection.status = "connecting";
        connection.lastError = null;
        connection.updatedAt = nowIso();
      });
      return { provider: state.provider, selectionId };
    }
    const candidate = result.candidates[0];
    if (!candidate)
      throw new MetaOAuthError(
        "no_page",
        "Nem található kezelhető kapcsolat ehhez a Meta-fiókhoz.",
      );
    await transact((database) => {
      const connection = database.channelConnections.find(
        (item) =>
          item.id === state.connectionId &&
          item.workspaceId === state.workspaceId &&
          item.brandId === state.brandId &&
          item.provider === state.provider,
      );
      if (!connection) throw new MetaOAuthError("unexpected", "A csatornakapcsolat nem található.");
      Object.assign(connection, {
        externalAccountId: candidate.externalAccountId,
        externalAccountName: candidate.externalAccountName,
        accessToken: candidate.encryptedAccessToken,
        refreshToken: null,
        tokenExpiresAt: candidate.tokenExpiresAt,
        scopes: candidate.scopes,
        status: "connected" as const,
        connectedAt: connection.connectedAt || nowIso(),
        updatedAt: nowIso(),
        lastError: null,
      });
    });
    return { provider: state.provider, externalAccountName: candidate.externalAccountName };
  } catch (cause) {
    const error =
      cause instanceof MetaOAuthError
        ? cause
        : new MetaOAuthError("unexpected", "Nem sikerült menteni a Meta-kapcsolatot.");
    await setConnectionError(state, "error", error.message);
    throw error;
  }
}

async function completeMetaConnection(provider: "facebook" | "instagram", code: string) {
  const config = metaConfig();
  const shortLived = await metaRequest<{ access_token?: string; expires_in?: number }>(
    "oauth/access_token",
    {
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: config.redirectUri,
      code,
    },
  );
  if (!shortLived.access_token)
    throw new MetaOAuthError("provider", "A Meta nem adott vissza hozzáférési tokent.");
  const longLived = await metaRequest<{ access_token?: string; expires_in?: number }>(
    "oauth/access_token",
    {
      grant_type: "fb_exchange_token",
      client_id: config.appId,
      client_secret: config.appSecret,
      fb_exchange_token: shortLived.access_token,
    },
  );
  const userToken = longLived.access_token || shortLived.access_token;
  const permissions = await grantedPermissions(userToken);
  const pageResponse = await metaRequest<{
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string };
    }>;
  }>("me/accounts", {
    fields: "id,name,access_token,instagram_business_account",
    access_token: userToken,
    limit: "100",
  });
  const pages =
    pageResponse.data?.filter((candidate) => candidate.id && candidate.access_token) || [];
  if (!pages.length)
    throw new MetaOAuthError(
      "no_page",
      "Nem található kezelhető Facebook-oldal ehhez a Meta-fiókhoz.",
    );
  const expiresIn = Number(longLived.expires_in || shortLived.expires_in || 0);
  const candidates: ChannelOAuthSelectionCandidate[] = [];
  for (const page of pages) {
    if (!page.id || !page.access_token) continue;
    const encryptedAccessToken = encryptToken(page.access_token);
    if (!encryptedAccessToken) continue;
    if (provider === "facebook") {
      candidates.push({
        id: newId("channel-option"),
        externalAccountId: page.id,
        externalAccountName: page.name || "Facebook oldal",
        pageName: page.name || null,
        encryptedAccessToken,
        tokenExpiresAt:
          expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
        scopes: permissions,
      });
      continue;
    }
    const instagramId = page.instagram_business_account?.id;
    if (!instagramId) continue;
    const instagram = await metaRequest<{ id?: string; username?: string; name?: string }>(
      instagramId,
      { fields: "id,username,name", access_token: page.access_token },
    );
    candidates.push({
      id: newId("channel-option"),
      externalAccountId: instagram.id || instagramId,
      externalAccountName: instagram.username
        ? `@${instagram.username}`
        : instagram.name || "Instagram Professional-fiók",
      pageName: page.name || null,
      encryptedAccessToken,
      tokenExpiresAt: expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      scopes: permissions,
    });
  }
  if (provider === "instagram" && !candidates.length)
    throw new MetaOAuthError(
      "no_instagram",
      "Az Instagram-fiókodnak Professional fióknak kell lennie, és megfelelő Facebook Page-hez kell kapcsolódnia.",
    );
  return {
    candidates,
  };
}

async function grantedPermissions(userToken: string) {
  const response = await metaRequest<{ data?: Array<{ permission?: string; status?: string }> }>(
    "me/permissions",
    { access_token: userToken },
  );
  return response.data
    ?.filter((item) => item.permission && item.status === "granted")
    .map((item) => item.permission as string) || [];
}

async function metaRequest<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string>,
) {
  const normalizedPath = path.replace(/^\//, "");
  const isTokenExchange = normalizedPath === "oauth/access_token";
  const { access_token: accessToken, ...safeParams } = params;
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const requestUrl = new URL(
    `https://graph.facebook.com/${metaVersion()}/${normalizedPath}`,
  );
  if (!isTokenExchange) {
    requestUrl.search = new URLSearchParams(safeParams).toString();
  }
  const response = await fetch(
    requestUrl,
    isTokenExchange
      ? {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(params),
          signal: AbortSignal.timeout(15_000),
        }
      : { headers, signal: AbortSignal.timeout(15_000) },
  );
  const body = (await response.json().catch(() => null)) as
    (T & { error?: { code?: number; type?: string; message?: string } }) | null;
  const providerMessage = body?.error?.message
    ?.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
    .slice(0, 300);
  if (!response.ok || !body) {
    const details = [
      `HTTP ${response.status}`,
      body?.error?.code ? `kód ${body.error.code}` : null,
      body?.error?.type ? `típus ${body.error.type}` : null,
      providerMessage ? `üzenet: ${providerMessage}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    throw new MetaOAuthError(
      "provider",
      `A Meta API-kérés sikertelen volt${details ? ` (${details})` : ""}.`,
    );
  }
  if (body.error) {
    const details = [
      body.error.code ? `kód ${body.error.code}` : null,
      body.error.type ? `típus ${body.error.type}` : null,
      providerMessage ? `üzenet: ${providerMessage}` : null,
    ]
      .filter(Boolean)
      .join(", ");
    throw new MetaOAuthError(
      "provider",
      `A Meta elutasította a hozzáférést vagy a kért műveletet${details ? ` (${details})` : ""}.`,
    );
  }
  return body as T;
}
