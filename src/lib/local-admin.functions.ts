import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  isLocalAdminRequest,
  localAdminConfiguration,
  localAdminSnapshot,
} from "@/lib/server/local-admin.server";
import { readData } from "@/lib/server/store.server";
import { useAppSession } from "@/lib/server/session.server";

export const getLocalAdminLoginAvailability = createServerFn({ method: "GET" }).handler(
  async () => {
    const config = localAdminConfiguration();
    if (!isLocalAdminRequest(getRequest(), config)) return false;
    return Boolean(localAdminSnapshot(await readData(), config));
  },
);

export const loginLocalAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const config = localAdminConfiguration();
  if (!isLocalAdminRequest(getRequest(), config))
    throw new Error("Ez a belépés kizárólag helyi fejlesztésben használható.");
  const snapshot = localAdminSnapshot(await readData(), config);
  if (!snapshot) throw new Error("A helyi admin munkatér nem érhető el.");
  const session = await useAppSession();
  // Clear prior test-session fields and issue the normal encrypted auth session.
  await session.clear();
  await session.update({
    userId: snapshot.user.id,
    workspaceId: snapshot.workspace.id,
    activeBrandId: snapshot.activeBrand?.id,
    themePreference: "marketingpilot-v2",
  });
  return { ok: true };
});
