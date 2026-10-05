import { createFileRoute } from "@tanstack/react-router";
import { readFile } from "node:fs/promises";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import { mediaPathForId, readData, removeMediaFile, transact } from "@/lib/server/store.server";
import { verifyMediaAccess } from "@/lib/server/token-crypto.server";

export const Route = createFileRoute("/api/media/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const requestUrl = new URL(request.url);
        const expiresAt = Number(requestUrl.searchParams.get("expires"));
        const signature = requestUrl.searchParams.get("signature") ?? "";
        const publicAccess = verifyMediaAccess(params.id, expiresAt, signature);
        let context: Awaited<ReturnType<typeof requireAuthContext>> | undefined;
        if (!publicAccess) {
          try { context = await requireAuthContext(); } catch { return Response.json({ error: "Bejelentkezés szükséges." }, { status: 401 }); }
        }
        const database = await readData();
        const asset = database.mediaAssets.find((candidate) => candidate.id === params.id && (publicAccess || (context && candidate.workspaceId === context.workspace.id && context.brands.some((brand) => brand.id === candidate.brandId))));
        if (!asset) return Response.json({ error: "A médiafájl nem található." }, { status: 404 });
        try { const bytes = await readFile(mediaPathForId(asset.id)); const safeName = asset.filename.replace(/["\r\n]/g, ""); return new Response(bytes, { headers: { "Content-Type": asset.mimeType, "Content-Length": String(asset.size), "Cache-Control": "private, max-age=3600", "Content-Disposition": `inline; filename="${safeName}"` } }); } catch { return Response.json({ error: "A médiafájl nem olvasható." }, { status: 404 }); }
      },
      DELETE: async ({ params }) => {
        let context: Awaited<ReturnType<typeof requireAuthContext>> | undefined;
        try { context = await requireAuthContext(); } catch { return Response.json({ error: "Bejelentkezés szükséges." }, { status: 401 }); }
        const asset = await transact((database) => { const found = database.mediaAssets.find((candidate) => candidate.id === params.id && candidate.workspaceId === context.workspace.id && context.brands.some((brand) => brand.id === candidate.brandId)); if (!found) throw new Error("A médiafájl nem található."); database.mediaAssets = database.mediaAssets.filter((candidate) => candidate.id !== found.id); for (const post of database.posts) if (post.workspaceId === context.workspace.id && post.brandId === found.brandId) post.mediaAssetIds = post.mediaAssetIds.filter((id) => id !== found.id); return found; });
        await removeMediaFile(asset.id); return Response.json({ ok: true });
      },
    },
  },
});
