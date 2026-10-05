import { createServerFn } from "@tanstack/react-start";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import { readData } from "@/lib/server/store.server";

export const getMediaAssets = createServerFn({ method: "GET" }).handler(async () => {
  const context = await requireAuthContext(); const database = await readData();
  return database.mediaAssets.filter((asset) => asset.workspaceId === context.workspace.id && context.brands.some((brand) => brand.id === asset.brandId)).map((asset) => ({ ...asset, brandName: context.brands.find((brand) => brand.id === asset.brandId)?.name ?? "Ismeretlen márka" }));
});
