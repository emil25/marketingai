import { redirect } from "@tanstack/react-router";
import type { WorkspaceSnapshot } from "@/lib/data-model";
import { getWorkspaceSnapshot, readData } from "@/lib/server/store.server";
import { useAppSession as getAppSession } from "@/lib/server/session.server";

export async function getOptionalAuthContext(): Promise<WorkspaceSnapshot | null> {
  const session = await getAppSession();
  const userId = session.data.userId;
  const workspaceId = session.data.workspaceId;
  if (!userId || !workspaceId) return null;
  const database = await readData();
  const user = database.users.find((item) => item.id === userId);
  if (!user || user.auth?.deleting || (user.auth?.sessionVersion ?? 0) !== (session.data.sessionVersion ?? 0)) return null;
  return getWorkspaceSnapshot(database, userId, workspaceId, session.data.activeBrandId);
}

export async function requireAuthContext(): Promise<WorkspaceSnapshot> {
  const context = await getOptionalAuthContext();
  if (!context) throw redirect({ to: "/login" });
  return context;
}

export async function requireBrandContext(): Promise<WorkspaceSnapshot & { brandId: string }> {
  const context = await requireAuthContext();
  if (!context.activeBrand) throw new Error("Még nincs aktív márka ebben a munkatérben.");
  return { ...context, brandId: context.activeBrand.id };
}
