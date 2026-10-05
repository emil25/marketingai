import { createFileRoute } from "@tanstack/react-router";
import { requireAuthContext } from "@/lib/server/auth-context.server";
import { newId, nowIso, removeMediaFile, transact, writeMediaFile } from "@/lib/server/store.server";
import type { MediaAssetRecord } from "@/lib/data-model";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
]);

export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let context;
        try { context = await requireAuthContext(); } catch { return Response.json({ error: "Bejelentkezés szükséges." }, { status: 401 }); }
        const form = await request.formData();
        const uploaded = form.get("file");
        const brandId = String(form.get("brandId") ?? context.activeBrand?.id ?? "");
        const altText = String(form.get("altText") ?? "").slice(0, 500);
        const source = form.get("source") === "ai" ? "ai" : "upload";
        if (!(uploaded instanceof File) || !uploaded.size) return Response.json({ error: "Válassz ki egy fájlt." }, { status: 400 });
        if (uploaded.size > MAX_FILE_SIZE) return Response.json({ error: "A fájl legfeljebb 10 MB lehet." }, { status: 413 });
        if (!ALLOWED_MIME_TYPES.has(uploaded.type.toLowerCase())) return Response.json({ error: "Nem támogatott fájltípus. PNG, JPEG, GIF, WebP, AVIF, MP4, WebM, MOV, MP3, WAV vagy OGG tölthető fel." }, { status: 415 });
        if (!context.brands.some((brand) => brand.id === brandId)) return Response.json({ error: "Nincs hozzáférés ehhez a márkához." }, { status: 403 });
        const id = newId("media");
        const asset: MediaAssetRecord = { id, workspaceId: context.workspace.id, brandId, filename: uploaded.name.slice(0, 240), mimeType: uploaded.type, size: uploaded.size, width: null, height: null, path: id, altText, source, createdAt: nowIso() };
        await writeMediaFile(id, new Uint8Array(await uploaded.arrayBuffer()));
        try {
          await transact((database) => { database.mediaAssets.push(asset); });
        } catch (error) {
          await removeMediaFile(id).catch(() => undefined);
          return Response.json({ error: "A média mentése sikertelen." }, { status: 500 });
        }
        return Response.json({ asset }, { status: 201 });
      },
    },
  },
});
