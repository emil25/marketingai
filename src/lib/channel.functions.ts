import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  ChannelConnectionRecord,
  ChannelConnectionStatus,
  ChannelOAuthSelectionRecord,
  ChannelProvider,
} from "@/lib/data-model";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import { decryptToken } from "@/lib/server/token-crypto.server";
import { nowIso, readData, transact } from "@/lib/server/store.server";

const META_PROVIDERS = new Set<ChannelProvider>(["facebook", "instagram"]);

export type SafeChannelConnection = Omit<
  ChannelConnectionRecord,
  "accessToken" | "refreshToken"
> & {
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
};

export type SafeChannelOAuthSelection = Omit<ChannelOAuthSelectionRecord, "candidates"> & {
  candidates: Array<
    Omit<ChannelOAuthSelectionRecord["candidates"][number], "encryptedAccessToken">
  >;
};

function safeConnection(connection: ChannelConnectionRecord): SafeChannelConnection {
  const { accessToken, refreshToken, ...safe } = connection;
  return { ...safe, hasAccessToken: Boolean(accessToken), hasRefreshToken: Boolean(refreshToken) };
}

function connectionFor(
  data: Awaited<ReturnType<typeof readData>>,
  context: Awaited<ReturnType<typeof requireAuthContext>>,
  connectionId: string,
) {
  const connection = data.channelConnections.find(
    (candidate) =>
      candidate.id === connectionId &&
      candidate.workspaceId === context.workspace.id &&
      context.activeBrand?.id === candidate.brandId &&
      context.brands.some((brand) => brand.id === candidate.brandId),
  );
  if (!connection) throw new Error("A csatornakapcsolat nem található ebben a munkatérben.");
  return connection;
}

export const getChannelConnections = createServerFn({ method: "GET" }).handler(async () => {
  const context = await requireAuthContext();
  const data = await readData();
  const activeBrandId = context.activeBrand?.id;
  if (!activeBrandId) return [] as SafeChannelConnection[];
  const now = Date.now();
  const expiredStates = data.channelOAuthStates.filter(
    (state) => Date.parse(state.expiresAt) <= now,
  );
  const expiredConnectionIds = new Set(expiredStates.map((state) => state.connectionId));
  const expiredSelections = data.channelOAuthSelections.filter(
    (selection) => Date.parse(selection.expiresAt) <= now,
  );
  const expiredSelectionConnectionIds = new Set(
    expiredSelections.map((selection) => selection.connectionId),
  );
  return data.channelConnections
    .filter(
      (connection) =>
        connection.workspaceId === context.workspace.id && connection.brandId === activeBrandId,
    )
    .map((connection) => {
      if (expiredConnectionIds.has(connection.id) && connection.status === "connecting")
        return {
          ...connection,
          status: "not_connected" as ChannelConnectionStatus,
          lastError: null,
        };
      if (expiredSelectionConnectionIds.has(connection.id) && connection.status === "connecting")
        return {
          ...connection,
          status: "not_connected" as ChannelConnectionStatus,
          lastError: null,
        };
      if (
        connection.status === "connected" &&
        connection.tokenExpiresAt &&
        Date.parse(connection.tokenExpiresAt) <= now
      )
        return {
          ...connection,
          status: "expired" as ChannelConnectionStatus,
          lastError: "A hozzáférési token lejárt.",
        };
      return connection;
    })
    .map(safeConnection);
});

export const getChannelOAuthSelection = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ selectionId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const database = await readData();
    const selection = database.channelOAuthSelections.find(
      (candidate) =>
        candidate.id === data.selectionId &&
        candidate.userId === context.user.id &&
        candidate.workspaceId === context.workspace.id &&
        candidate.brandId === context.activeBrand?.id &&
        Date.parse(candidate.expiresAt) > Date.now(),
    );
    if (!selection) throw new Error("A csatornaválasztás érvénytelen vagy lejárt.");
    return {
      ...selection,
      candidates: selection.candidates.map(
        ({ encryptedAccessToken: _token, ...candidate }) => candidate,
      ),
    } satisfies SafeChannelOAuthSelection;
  });

export const completeChannelOAuthSelection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ selectionId: z.string().min(1), candidateId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const result = await transact((database) => {
      const selection = database.channelOAuthSelections.find(
        (candidate) =>
          candidate.id === data.selectionId &&
          candidate.userId === context.user.id &&
          candidate.workspaceId === context.workspace.id &&
          candidate.brandId === context.activeBrand?.id &&
          Date.parse(candidate.expiresAt) > Date.now(),
      );
      if (!selection) throw new Error("A csatornaválasztás érvénytelen vagy lejárt.");
      const option = selection.candidates.find((candidate) => candidate.id === data.candidateId);
      if (!option) throw new Error("A kiválasztott csatorna nem található.");
      const connection = connectionFor(database, context, selection.connectionId);
      if (connection.provider !== selection.provider)
        throw new Error("A csatornaválasztás szolgáltatója nem egyezik.");
      Object.assign(connection, {
        externalAccountId: option.externalAccountId,
        externalAccountName: option.externalAccountName,
        accessToken: option.encryptedAccessToken,
        refreshToken: null,
        tokenExpiresAt: option.tokenExpiresAt,
        scopes: option.scopes,
        status: "connected" as const,
        connectedAt: connection.connectedAt || nowIso(),
        updatedAt: nowIso(),
        lastError: null,
      });
      database.channelOAuthSelections = database.channelOAuthSelections.filter(
        (candidate) => candidate.id !== selection.id,
      );
      return { provider: selection.provider, externalAccountName: option.externalAccountName };
    });
    return result;
  });

export const disconnectChannel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ connectionId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    await transact((database) => {
      const connection = connectionFor(database, context, data.connectionId);
      connection.status = "not_connected";
      connection.externalAccountId = null;
      connection.externalAccountName = null;
      connection.accessToken = null;
      connection.refreshToken = null;
      connection.tokenExpiresAt = null;
      connection.scopes = [];
      connection.connectedAt = null;
      connection.lastError = null;
      connection.updatedAt = nowIso();
      database.channelOAuthStates = database.channelOAuthStates.filter(
        (state) => state.connectionId !== connection.id,
      );
    });
    return { ok: true };
  });

export const refreshChannelConnection = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ connectionId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    const database = await readData();
    const connection = connectionFor(database, context, data.connectionId);
    if (!META_PROVIDERS.has(connection.provider))
      throw new Error("Ehhez a szolgáltatóhoz még nincs frissítési adapter.");
    if (!connection.accessToken)
      throw new Error("A kapcsolat tokenje hiányzik; csatlakoztasd újra a csatornát.");
    let token: string;
    try {
      token = decryptToken(connection.accessToken) || "";
    } catch {
      throw new Error("A kapcsolat biztonságos tokenje nem olvasható; csatlakoztasd újra.");
    }
    if (!token) throw new Error("A kapcsolat tokenje hiányzik; csatlakoztasd újra a csatornát.");
    try {
      const response = await fetch(
        `https://graph.facebook.com/${process.env["META_GRAPH_VERSION"] || "v26.0"}/me?fields=id,name`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) },
      );
      if (!response.ok) throw new Error("A Meta nem fogadta el a kapcsolat ellenőrzését.");
      await transact((db) => {
        const current = connectionFor(db, context, data.connectionId);
        current.status = "connected";
        current.lastError = null;
        current.updatedAt = nowIso();
      });
      return { ok: true };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "A Meta-kapcsolat ellenőrzése nem sikerült.";
      await transact((db) => {
        const current = connectionFor(db, context, data.connectionId);
        current.status = "expired";
        current.lastError = message.slice(0, 500);
        current.updatedAt = nowIso();
      });
      throw new Error(message);
    }
  });
