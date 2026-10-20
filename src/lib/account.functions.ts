import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuthContext } from "./server/auth-context.server";
import { readData, transact } from "./server/store.server";
import { useAppSession } from "./server/session.server";
import { removeAccountReferences } from "./server/account-deletion.server";
import {
  authConfiguration,
  consumeAuthLimit,
  matchesAuthToken,
  newAuthToken,
  protectAuth,
  sendAuthEmail,
} from "./server/auth-security.server";

export const getAuthConfiguration = createServerFn({ method: "GET" }).handler(async () =>
  authConfiguration(),
);
export const resendVerification = createServerFn({ method: "POST" }).handler(async () => {
  const context = await requireAuthContext();
  await consumeAuthLimit(`verify:${context.user.id}`, 3, 15);
  const token = newAuthToken(1440);
  const email = await transact((db) => {
    const user = db.users.find((item) => item.id === context.user.id)!;
    if (!user.auth || user.auth.emailVerifiedAt)
      throw new Error("Az e-mail-címed már meg van erősítve.");
    user.auth.verification = token.stored;
    return user.email;
  });
  await sendAuthEmail(email, "verify", token.token);
  return { ok: true };
});
const TokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export const verifyEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => TokenSchema.parse(data))
  .handler(async ({ data }) => {
    await consumeAuthLimit(`verify-token:${data.token.slice(0, 16)}`, 8, 15);
    await transact((db) => {
      const user = db.users.find((item) => matchesAuthToken(item.auth?.verification, data.token));
      if (!user?.auth || user.auth.deleting)
        throw new Error(
          "Ez a megerősítő hivatkozás lejárt vagy már felhasználtad. Kérj új levelet.",
        );
      user.auth.emailVerifiedAt = new Date().toISOString();
      delete user.auth.verification;
    });
    return { ok: true };
  });
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().email().max(180),
        botToken: z.string().max(2048).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await protectAuth("reset", data.email, data.botToken, 3);
    if (!authConfiguration().passwordResetAvailable)
      throw new Error("A jelszó-visszaállítás átmenetileg nem érhető el. Próbáld újra később.");
    const token = newAuthToken(30);
    const email = await transact((db) => {
      const user = db.users.find(
        (item) => item.email === data.email.toLowerCase() && !item.auth?.deleting,
      );
      if (!user) return null;
      user.auth ??= { emailVerifiedAt: user.createdAt, sessionVersion: 0 };
      user.auth.reset = token.stored;
      return user.email;
    });
    // Account existence and delivery errors intentionally produce the same public response.
    if (email)
      try {
        await sendAuthEmail(email, "reset", token.token);
      } catch {
        console.error(JSON.stringify({ event: "password_reset_delivery_failed" }));
      }
    return { ok: true };
  });
export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    TokenSchema.extend({ password: z.string().min(8).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    await consumeAuthLimit(`reset-token:${data.token.slice(0, 16)}`, 8, 15);
    const { hashPassword } = await import("./server/password.server");
    const hash = hashPassword(data.password);
    await transact((db) => {
      const user = db.users.find((item) => matchesAuthToken(item.auth?.reset, data.token));
      if (!user?.auth || user.auth.deleting)
        throw new Error(
          "A hivatkozás lejárt vagy már felhasználtad. Kérj új jelszó-visszaállító levelet.",
        );
      user.passwordHash = hash;
      user.auth.sessionVersion += 1;
      delete user.auth.reset;
    });
    await (await useAppSession()).clear();
    return { ok: true };
  });
export const changePassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ currentPassword: z.string().min(1).max(200), password: z.string().min(8).max(200) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const context = await requireAuthContext();
    await consumeAuthLimit(`password:${context.user.id}`, 5, 15);
    const { hashPassword, verifyPassword } = await import("./server/password.server");
    const version = await transact((db) => {
      const user = db.users.find((item) => item.id === context.user.id)!;
      if (!verifyPassword(data.currentPassword, user.passwordHash))
        throw new Error("A jelenlegi jelszó nem megfelelő.");
      user.passwordHash = hashPassword(data.password);
      user.auth ??= { emailVerifiedAt: user.createdAt, sessionVersion: 0 };
      user.auth.sessionVersion += 1;
      delete user.auth.reset;
      return user.auth.sessionVersion;
    });
    await (await useAppSession()).update({ sessionVersion: version });
    return { ok: true };
  });
export const exportAccount = createServerFn({ method: "POST" }).handler(async () => {
  const context = await requireAuthContext();
  const db = await readData();
  const workspaces = new Set(
    db.memberships.filter((m) => m.userId === context.user.id).map((m) => m.workspaceId),
  );
  const brands = db.brands.filter((b) => workspaces.has(b.workspaceId));
  const brandIds = new Set(brands.map((b) => b.id));
  const postIds = new Set(db.posts.filter((p) => workspaces.has(p.workspaceId)).map((p) => p.id));
  return {
    exportedAt: new Date().toISOString(),
    user: context.user,
    workspaces: db.workspaces.filter((w) => workspaces.has(w.id)),
    brands,
    brandProfiles: db.brandProfiles.filter((b) => brandIds.has(b.brandId)),
    posts: db.posts.filter((p) => workspaces.has(p.workspaceId)),
    postVariants: db.postVariants.filter((p) => postIds.has(p.postId)),
    postVersions: db.postVersions.filter((p) => postIds.has(p.postId)),
    campaigns: db.campaigns.filter((p) => workspaces.has(p.workspaceId)),
    planItems: db.planItems.filter((p) => workspaces.has(p.workspaceId)),
    mediaAssets: db.mediaAssets.filter((p) => workspaces.has(p.workspaceId)),
    analyticsSnapshots: db.analyticsSnapshots.filter((p) => workspaces.has(p.workspaceId)),
    // Tokens, OAuth states, credentials and raw AI job payloads are deliberately excluded.
  };
});
export const deleteAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({ password: z.string().min(1).max(200), confirmation: z.literal("TÖRLÉS") })
      .parse(data),
  )
  .handler(async ({ data }) => {
    // A deletion tombstone revokes access immediately, but this endpoint remains retryable
    // with the original signed session and password if object storage is unavailable.
    const session = await useAppSession();
    const userId = session.data.userId;
    if (!userId) throw new Error("Jelentkezz be a fiókod törléséhez.");
    await consumeAuthLimit(`delete:${userId}`, 5, 15);
    const { verifyPassword } = await import("./server/password.server");
    const owned = await transact((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (
        !user ||
        !verifyPassword(data.password, user.passwordHash) ||
        (user.auth?.sessionVersion ?? 0) !== (session.data.sessionVersion ?? 0)
      )
        throw new Error("A jelszó nem megfelelő, vagy a munkamenet lejárt.");
      const ids = db.memberships
        .filter((m) => m.userId === userId && m.role === "owner")
        .map((m) => m.workspaceId);
      if (db.memberships.some((m) => ids.includes(m.workspaceId) && m.userId !== userId))
        throw new Error(
          "A közös vállalkozás tulajdonjogát előbb add át. Más csapattag adatait nem töröljük.",
        );
      user.auth ??= { emailVerifiedAt: user.createdAt, sessionVersion: 0 };
      user.auth.deleting = true;
      return ids;
    });
    const db = await readData();
    const { removeMediaFile } = await import("./server/store.server");
    try {
      for (const asset of db.mediaAssets.filter((a) => owned.includes(a.workspaceId)))
        await removeMediaFile(asset.id);
    } catch {
      throw new Error(
        "A média törlése most nem sikerült. A fiók zárolva maradt. Ezen az oldalon újrapróbálhatod a törlést.",
      );
    }
    // AI audit contains no prompt/response and is removed before deleting the user.
    const { deleteUserAiAudit } = await import("./server/ai-calls.server");
    await deleteUserAiAudit(userId);
    await transact((database) => {
      removeAccountReferences(database, userId);
      const brandIds = new Set(
        database.brands.filter((b) => owned.includes(b.workspaceId)).map((b) => b.id),
      );
      const postIds = new Set(
        database.posts.filter((p) => owned.includes(p.workspaceId)).map((p) => p.id),
      );
      database.postVariants = database.postVariants.filter((p) => !postIds.has(p.postId));
      database.postVersions = database.postVersions.filter((p) => !postIds.has(p.postId));
      database.brandProfiles = database.brandProfiles.filter((b) => !brandIds.has(b.brandId));
      for (const key of [
        "brands",
        "posts",
        "campaigns",
        "planItems",
        "mediaAssets",
        "analyticsSnapshots",
        "channelConnections",
        "channelOAuthStates",
        "channelOAuthSelections",
        "publishAttempts",
      ] as const) {
        database[key] = database[key].filter((p) => !owned.includes(p.workspaceId)) as never;
      }
      database.aiJobs = database.aiJobs.filter(
        (j) => !owned.includes(j.workspaceId) && j.input?.userId !== userId,
      );
      database.memberships = database.memberships.filter(
        (m) => m.userId !== userId && !owned.includes(m.workspaceId),
      );
      database.workspaces = database.workspaces.filter((w) => !owned.includes(w.id));
      database.users = database.users.filter((u) => u.id !== userId);
    });
    await session.clear();
    return { ok: true };
  });
