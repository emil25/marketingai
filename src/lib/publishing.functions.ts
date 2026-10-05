import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  ChannelConnectionRecord,
  PostPlatform,
  PublishAttemptRecord,
  PublishAttemptStatus,
} from "@/lib/data-model";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import { decryptToken, signMediaAccess } from "@/lib/server/token-crypto.server";
import { newId, nowIso, readData, transact } from "@/lib/server/store.server";
import { postCopyText } from "@/lib/post-editor";
import { selectedCreativeIds } from "@/lib/post-creative";
import {
  publishFacebookImages,
  publishInstagramImages,
} from "@/lib/server/creative-publishing.server";

const PublishPlatformSchema = z.enum(["facebook", "instagram"]);
const PublishInputSchema = z.object({
  postId: z.string().min(1),
  platform: PublishPlatformSchema,
});

export type PublishPlatform = z.infer<typeof PublishPlatformSchema>;
export type SafePublishAttempt = Omit<PublishAttemptRecord, "connectionId"> & {
  connectionId: string | null;
};
export type SafePublicationInfo = {
  connections: Array<{
    id: string;
    provider: PublishPlatform;
    status: ChannelConnectionRecord["status"];
    externalAccountName: string | null;
    scopes: string[];
    hasAccessToken: boolean;
  }>;
  attempts: SafePublishAttempt[];
};

type PublishErrorCode = "validation" | "auth" | "permission" | "media" | "provider";

export class PublishError extends Error {
  constructor(
    readonly code: PublishErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PublishError";
  }
}

function safeConnection(connection: ChannelConnectionRecord) {
  const expired =
    connection.status === "connected" &&
    Boolean(connection.tokenExpiresAt) &&
    Date.parse(connection.tokenExpiresAt as string) <= Date.now();
  return {
    id: connection.id,
    provider: connection.provider as PublishPlatform,
    status: expired ? ("expired" as const) : connection.status,
    externalAccountName: connection.externalAccountName,
    scopes: [...connection.scopes],
    hasAccessToken: Boolean(connection.accessToken),
  };
}

async function ownedPost(postId: string) {
  const context = await requireAuthContext();
  const database = await readData();
  const post = database.posts.find(
    (candidate) =>
      candidate.id === postId &&
      candidate.workspaceId === context.workspace.id &&
      context.brands.some((brand) => brand.id === candidate.brandId),
  );
  if (!post) throw new PublishError("validation", "A poszt nem található ebben a munkatérben.");
  const brand = context.brands.find((candidate) => candidate.id === post.brandId);
  if (!brand) throw new PublishError("validation", "A poszt márkája nem található.");
  return { context, database, post, brand };
}

export const getPostPublicationInfo = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ postId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { context, database, post } = await ownedPost(data.postId);
    const connections = database.channelConnections
      .filter(
        (connection) =>
          connection.workspaceId === context.workspace.id &&
          connection.brandId === post.brandId &&
          (connection.provider === "facebook" || connection.provider === "instagram"),
      )
      .map(safeConnection);
    const attempts = database.publishAttempts
      .filter(
        (attempt) =>
          attempt.postId === post.id &&
          attempt.workspaceId === context.workspace.id &&
          attempt.brandId === post.brandId,
      )
      .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))
      .slice(0, 20);
    return { connections, attempts } satisfies SafePublicationInfo;
  });

function graphVersion() {
  const value = process.env["META_GRAPH_VERSION"] || "v26.0";
  if (!/^v\d+\.\d+$/.test(value))
    throw new PublishError("validation", "A Meta Graph verzió érvénytelen.");
  return value;
}

function graphUrl(path: string) {
  return `https://graph.facebook.com/${graphVersion()}/${path.replace(/^\/+/, "")}`;
}

function providerMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body) {
    const error = (body as { error?: { message?: unknown; code?: unknown } }).error;
    if (error?.code === 190)
      return "A Meta-hozzáférés lejárt vagy érvénytelen. Csatlakoztasd újra a csatornát.";
    if (typeof error?.message === "string" && error.message.trim())
      return error.message.slice(0, 400);
  }
  return fallback;
}

async function graphRequest<T>(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string>,
) {
  const { access_token: accessToken, ...safeParams } = params;
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(
    method === "GET" ? `${graphUrl(path)}?${new URLSearchParams(safeParams)}` : graphUrl(path),
    {
      method,
      headers:
        method === "POST"
          ? { ...headers, "Content-Type": "application/x-www-form-urlencoded" }
          : headers,
      body: method === "POST" ? new URLSearchParams(safeParams) : undefined,
      signal: AbortSignal.timeout(30_000),
    },
  );
  const body = (await response.json().catch(() => null)) as (T & { error?: unknown }) | null;
  if (!response.ok || !body || body.error) {
    const errorCode =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "object" &&
      body.error &&
      "code" in body.error
        ? (body.error as { code?: unknown }).code
        : undefined;
    if (errorCode === 190)
      throw new PublishError(
        "auth",
        providerMessage(body, "A Meta-hozzáférés lejárt vagy érvénytelen."),
      );
    if (errorCode === 10 || errorCode === 200)
      throw new PublishError(
        "permission",
        providerMessage(body, "A Meta nem engedélyezte ezt a publikálási jogosultságot."),
      );
    if (response.status === 401 || response.status === 403)
      throw new PublishError(
        "permission",
        providerMessage(body, "A Meta nem engedélyezte ezt a publikálást."),
      );
    throw new PublishError(
      "provider",
      providerMessage(body, "A Meta publikálási kérése sikertelen volt."),
    );
  }
  return body as T;
}

function requiredScopes(platform: PublishPlatform) {
  return platform === "facebook" ? ["pages_manage_posts"] : ["instagram_content_publish"];
}

function publicMediaUrl(mediaId: string) {
  const configured = process.env["MEDIA_PUBLIC_BASE_URL"] || process.env["PUBLIC_APP_URL"];
  if (!configured) {
    throw new PublishError(
      "media",
      "Képes publikáláshoz nyilvánosan elérhető MEDIA_PUBLIC_BASE_URL vagy PUBLIC_APP_URL szükséges.",
    );
  }
  let base: URL;
  try {
    base = new URL(configured);
  } catch {
    throw new PublishError("media", "A nyilvános média URL beállítása érvénytelen.");
  }
  if (base.protocol !== "https:" || ["localhost", "127.0.0.1", "::1"].includes(base.hostname)) {
    throw new PublishError(
      "media",
      "Képes publikáláshoz HTTPS-en, nyilvánosan elérhető média URL szükséges; a localhost nem használható.",
    );
  }
  const basePath = base.pathname.replace(/\/+$/, "");
  base.pathname = `${basePath}/api/media/${encodeURIComponent(mediaId)}`;
  const expiresAt = Math.floor(Date.now() / 1000) + 10 * 60;
  base.searchParams.set("expires", String(expiresAt));
  base.searchParams.set("signature", signMediaAccess(mediaId, expiresAt));
  return base.toString();
}

function captionFor(
  variant: { content: string; hashtags: string[]; cta: string },
  maxLength = 30_000,
) {
  return postCopyText(variant).slice(0, maxLength);
}

async function preparePublication(postId: string, platform: PublishPlatform) {
  const { context, database, post } = await ownedPost(postId);
  const connection = database.channelConnections.find(
    (candidate) =>
      candidate.workspaceId === context.workspace.id &&
      candidate.brandId === post.brandId &&
      candidate.provider === platform,
  );
  if (!connection || connection.status !== "connected") {
    throw new PublishError(
      "validation",
      `${platform === "facebook" ? "Facebook" : "Instagram"} csatorna nincs csatlakoztatva.`,
    );
  }
  if (!connection.externalAccountId || !connection.accessToken) {
    throw new PublishError("validation", "A csatorna kapcsolata hiányos; csatlakoztasd újra.");
  }
  if (connection.tokenExpiresAt && Date.parse(connection.tokenExpiresAt) <= Date.now()) {
    throw new PublishError("auth", "A csatorna hozzáférési tokenje lejárt; csatlakoztasd újra.");
  }
  const missing = requiredScopes(platform).filter((scope) => !connection.scopes.includes(scope));
  if (missing.length) {
    throw new PublishError(
      "permission",
      `A ${platform === "facebook" ? "Facebook" : "Instagram"} publikáláshoz újracsatlakozás szükséges a megfelelő Meta-jogosultságokkal.`,
    );
  }
  let accessToken: string | null;
  try {
    accessToken = decryptToken(connection.accessToken);
  } catch {
    accessToken = null;
  }
  if (!accessToken)
    throw new PublishError(
      "auth",
      "A csatorna biztonságos hozzáférése nem olvasható; csatlakoztasd újra.",
    );
  const variant = database.postVariants.find(
    (candidate) =>
      candidate.postId === post.id && candidate.platform === platform && candidate.content.trim(),
  );
  if (!variant)
    throw new PublishError(
      "validation",
      `Nincs mentett ${platform === "facebook" ? "Facebook" : "Instagram"} platformváltozat ehhez a poszthoz.`,
    );
  let imageUrl: string | undefined;
  const creativeIds = selectedCreativeIds(database.aiJobs, post);
  const imageUrls = creativeIds.map((id) => {
    const asset = database.mediaAssets.find(
      (candidate) =>
        candidate.id === id &&
        candidate.workspaceId === post.workspaceId &&
        candidate.brandId === post.brandId &&
        candidate.mimeType === "image/jpeg",
    );
    if (!asset)
      throw new PublishError(
        "media",
        "A kreatív egyik képe hiányzik. Mentsd el újra a képeket a poszthoz.",
      );
    return publicMediaUrl(asset.id);
  });
  if (platform === "instagram") {
    const asset = database.mediaAssets.find(
      (candidate) =>
        candidate.id &&
        post.mediaAssetIds.includes(candidate.id) &&
        candidate.workspaceId === post.workspaceId &&
        candidate.brandId === post.brandId &&
        candidate.mimeType === "image/jpeg",
    );
    if (!asset)
      throw new PublishError(
        "media",
        "Instagram-publikáláshoz legalább egy JPEG kép szükséges a poszthoz.",
      );
    imageUrl = imageUrls[0] ?? publicMediaUrl(asset.id);
  }
  return { context, post, connection, accessToken, variant, imageUrl, imageUrls };
}

async function publishFacebook(prepared: Awaited<ReturnType<typeof preparePublication>>) {
  const account = await graphRequest<{ id?: string }>("GET", "me", {
    fields: "id",
    access_token: prepared.accessToken,
  });
  if (account.id && account.id !== prepared.connection.externalAccountId)
    throw new PublishError("auth", "A Facebook Page tokenje nem ehhez az oldalhoz tartozik.");
  if (prepared.imageUrls.length)
    return publishFacebookImages(
      {
        accountId: prepared.connection.externalAccountId!,
        accessToken: prepared.accessToken,
        caption: captionFor(prepared.variant),
        imageUrls: prepared.imageUrls,
      },
      graphRequest,
    );
  const result = await graphRequest<{ id?: string }>(
    "POST",
    `${prepared.connection.externalAccountId}/feed`,
    { message: captionFor(prepared.variant), access_token: prepared.accessToken },
  );
  if (!result.id)
    throw new PublishError("provider", "A Facebook nem adott vissza külső posztazonosítót.");
  return result.id;
}

async function publishInstagram(prepared: Awaited<ReturnType<typeof preparePublication>>) {
  if (!prepared.imageUrl)
    throw new PublishError("media", "Instagram-kép URL nem áll rendelkezésre.");
  await graphRequest<{ id?: string }>("GET", prepared.connection.externalAccountId!, {
    fields: "id",
    access_token: prepared.accessToken,
  });
  return publishInstagramImages(
    {
      accountId: prepared.connection.externalAccountId!,
      accessToken: prepared.accessToken,
      caption: captionFor(prepared.variant, 2_200),
      imageUrls: prepared.imageUrls.length ? prepared.imageUrls : [prepared.imageUrl],
    },
    graphRequest,
    () => new Promise((resolve) => setTimeout(resolve, 1000)),
  );
}
async function publishPostInternal(postId: string, platform: PublishPlatform, retryOf?: string) {
  const initial = await ownedPost(postId);
  const attempt = await transact((database) => {
    const post = database.posts.find(
      (candidate) =>
        candidate.id === postId &&
        candidate.workspaceId === initial.context.workspace.id &&
        candidate.brandId === initial.post.brandId,
    );
    if (!post) throw new PublishError("validation", "A poszt időközben eltűnt.");
    const connection = database.channelConnections.find(
      (candidate) =>
        candidate.workspaceId === post.workspaceId &&
        candidate.brandId === post.brandId &&
        candidate.provider === platform,
    );
    if (retryOf) {
      const previous = database.publishAttempts.find(
        (candidate) =>
          candidate.id === retryOf &&
          candidate.postId === post.id &&
          candidate.workspaceId === post.workspaceId &&
          candidate.brandId === post.brandId &&
          candidate.platform === platform,
      );
      if (!previous || previous.status !== "failed")
        throw new PublishError(
          "validation",
          "Csak sikertelen, ehhez a poszthoz tartozó publikálási kísérlet próbálható újra.",
        );
    }
    const record: PublishAttemptRecord = {
      id: newId("publish"),
      workspaceId: post.workspaceId,
      brandId: post.brandId,
      postId: post.id,
      connectionId: connection?.id ?? null,
      platform,
      status: "pending",
      requestedAt: nowIso(),
      retryOf,
    };
    database.publishAttempts.push(record);
    return record;
  });
  try {
    const prepared = await preparePublication(postId, platform);
    await transact((database) => {
      const current = database.publishAttempts.find((item) => item.id === attempt.id);
      if (current) {
        current.status = "running";
        current.startedAt = nowIso();
      }
    });
    const externalId =
      platform === "facebook" ? await publishFacebook(prepared) : await publishInstagram(prepared);
    await transact((database) => {
      const current = database.publishAttempts.find((item) => item.id === attempt.id);
      if (current) {
        current.status = "published";
        current.externalId = externalId;
        current.completedAt = nowIso();
      }
      const post = database.posts.find(
        (item) =>
          item.id === postId &&
          item.workspaceId === prepared.context.workspace.id &&
          item.brandId === prepared.post.brandId,
      );
      if (!post) return;
      post.status = "published";
      post.updatedAt = nowIso();
      const variant = database.postVariants.find(
        (item) => item.postId === post.id && item.platform === platform,
      );
      if (variant) {
        variant.status = "published";
        variant.updatedAt = post.updatedAt;
      }
      for (const planItem of database.planItems)
        if (
          planItem.postId === post.id &&
          planItem.workspaceId === post.workspaceId &&
          planItem.brandId === post.brandId &&
          planItem.platform === platform &&
          planItem.status !== "skipped"
        ) {
          planItem.status = "published";
          planItem.updatedAt = post.updatedAt;
        }
    });
    return { attemptId: attempt.id, status: "published" as const, externalId, platform };
  } catch (cause) {
    const error =
      cause instanceof PublishError
        ? cause
        : new PublishError(
            "provider",
            cause instanceof Error ? cause.message : "A publikálás sikertelen volt.",
          );
    await transact((database) => {
      const current = database.publishAttempts.find((item) => item.id === attempt.id);
      if (current) {
        current.status = "failed";
        current.error = error.message.slice(0, 500);
        current.completedAt = nowIso();
      }
      if (error.code === "auth") {
        const connection = database.channelConnections.find(
          (item) =>
            item.id === attempt.connectionId &&
            item.workspaceId === initial.context.workspace.id &&
            item.brandId === initial.post.brandId,
        );
        if (connection) {
          connection.status = "expired";
          connection.lastError = error.message.slice(0, 500);
          connection.updatedAt = nowIso();
        }
      }
      const post = database.posts.find(
        (item) =>
          item.id === postId &&
          item.workspaceId === initial.context.workspace.id &&
          item.brandId === initial.post.brandId,
      );
      if (post) {
        post.status = "failed";
        post.updatedAt = nowIso();
      }
      const variant = database.postVariants.find(
        (item) => item.postId === postId && item.platform === platform,
      );
      if (variant) {
        variant.status = "failed";
        variant.updatedAt = nowIso();
      }
    });
    throw error;
  }
}

export const publishPost = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => PublishInputSchema.parse(data))
  .handler(async ({ data }) => publishPostInternal(data.postId, data.platform));

export const retryPostPublication = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    PublishInputSchema.extend({ attemptId: z.string().min(1).optional() }).parse(data),
  )
  .handler(async ({ data }) => publishPostInternal(data.postId, data.platform, data.attemptId));
