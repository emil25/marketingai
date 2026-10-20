import { createFileRoute } from "@tanstack/react-router";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import { readMediaFile, readData, removeMediaFile, transact } from "@/lib/server/store.server";
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
          try {
            context = await requireAuthContext();
          } catch {
            return Response.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
          }
        }
        const database = await readData();
        const asset = database.mediaAssets.find(
          (candidate) =>
            candidate.id === params.id &&
            (publicAccess ||
              (context &&
                candidate.workspaceId === context.workspace.id &&
                context.brands.some((brand) => brand.id === candidate.brandId))),
        );
        if (!asset) return Response.json({ error: "A médiafájl nem található." }, { status: 404 });
        try {
          const bytes = await readMediaFile(asset.id);
          const safeName = asset.filename.replace(/["\r\n]/g, "");
          return new Response(bytes, {
            headers: {
              "Content-Type": asset.mimeType,
              "Content-Length": String(bytes.byteLength),
              "X-Content-Type-Options": "nosniff",
              "Cache-Control": "private, max-age=3600",
              "Content-Disposition": `inline; filename="${safeName}"`,
            },
          });
        } catch {
          return Response.json({ error: "A médiafájl nem olvasható." }, { status: 404 });
        }
      },
      DELETE: async ({ params }) => {
        let context: Awaited<ReturnType<typeof requireAuthContext>> | undefined;
        try {
          context = await requireAuthContext();
        } catch {
          return Response.json({ error: "Bejelentkezés szükséges." }, { status: 401 });
        }
        const database = await readData();
        const asset = database.mediaAssets.find(
          (candidate) =>
            candidate.id === params.id &&
            candidate.workspaceId === context.workspace.id &&
            context.brands.some((brand) => brand.id === candidate.brandId),
        );
        if (!asset) return Response.json({ error: "A médiafájl nem található." }, { status: 404 });
        try {
          // Keep metadata until private object removal succeeds, so failure remains retryable.
          await removeMediaFile(asset.id);
          await transact((database) => {
            database.mediaAssets = database.mediaAssets.filter(
              (candidate) => candidate.id !== asset.id,
            );
            for (const post of database.posts)
              if (post.workspaceId === context.workspace.id && post.brandId === asset.brandId)
                post.mediaAssetIds = post.mediaAssetIds.filter((id) => id !== asset.id);
          });
          return Response.json({ ok: true });
        } catch {
          console.error(
            JSON.stringify({ event: "media_delete_failed", code: "STORAGE_UNAVAILABLE" }),
          );
          return Response.json(
            {
              error:
                "A fájlt most nem sikerült teljesen törölni. Próbáld újra; a mentett tartalmaid megmaradtak.",
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
