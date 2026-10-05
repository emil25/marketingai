import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireBrandContext } from "@/lib/server/auth-context.server";
import { completeAiJob, createAiJob, startAiJob, transact } from "@/lib/server/store.server";
import { assertOpenRouterConfigured, openRouterImage } from "@/lib/server/ai-provider.server";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Érvénytelen képkérés." }, { status: 400 });
        }
        const parsed = z.object({ prompt: z.string().trim().min(2).max(4000), stream: z.boolean().optional().default(true), brandId: z.string().optional(), format: z.string().trim().max(120).optional() }).safeParse(body);
        if (!parsed.success) return Response.json({ error: "Érvénytelen képkérés." }, { status: 400 });
        const { prompt, stream, brandId, format } = parsed.data;
        let context;
        try { context = await requireBrandContext(); } catch { return Response.json({ error: "Bejelentkezés és aktív márka szükséges." }, { status: 401 }); }
        const brand = context.activeBrand;
        if (!brand) return Response.json({ error: "Bejelentkezés és aktív márka szükséges." }, { status: 401 });
        if (brandId && brandId !== brand.id) return Response.json({ error: "Nincs hozzáférés ehhez a márkához." }, { status: 403 });
        const job = await transact((database) => createAiJob(database, { workspaceId: context.workspace.id, brandId: brand.id, type: "image", input: { prompt, format, brandVoice: brand.profile, language: brand.languageMarket, audience: brand.audience, region: brand.cityRegion } }));
        await transact((database) => startAiJob(database, job.id));
        try {
          assertOpenRouterConfigured();
        } catch (cause) {
          const error = cause instanceof Error ? cause.message : "Hiányzik az OPENROUTER_API_KEY konfigurációja.";
          await transact((database) => completeAiJob(database, job.id, error));
          return Response.json({ error }, { status: 503 });
        }

        let upstream: Response;
        try {
          upstream = await openRouterImage({ prompt, stream });
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Image provider unavailable";
          await transact((database) => completeAiJob(database, job.id, message));
          return Response.json({ error: "A képgeneráló szolgáltatás nem érhető el." }, { status: 502 });
        }

        if (!upstream.ok || !upstream.body) {
          await transact((database) => completeAiJob(database, job.id, `Image provider error ${upstream.status}`));
          return new Response(await upstream.text(), { status: upstream.status });
        }
        if (!stream) {
          const body = await upstream.text();
          let validImage = false;
          try {
            const payload = JSON.parse(body) as { data?: Array<{ b64_json?: string }> };
            validImage = Boolean(payload.data?.[0]?.b64_json);
          } catch {
            validImage = false;
          }
          await transact((database) =>
            completeAiJob(database, job.id, validImage ? undefined : "A képgeneráló szolgáltatás üres választ adott."),
          );
          return new Response(body, { headers: { "Content-Type": "application/json" } });
        }

        const reader = upstream.body.getReader();
        let settled = false;
        const settleJob = async (error?: string) => {
          if (settled) return;
          settled = true;
          await transact((database) => completeAiJob(database, job.id, error));
        };
        const streamBody = new ReadableStream<Uint8Array>({
          async start(controller) {
            const decoder = new TextDecoder();
            let providerError = false;
            try {
              while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                const text = decoder.decode(chunk.value, { stream: true });
                if (/event:\s*error|"type"\s*:\s*"error"/.test(text)) providerError = true;
                controller.enqueue(chunk.value);
              }
              await settleJob(providerError ? "A képgeneráló szolgáltatás hibát adott." : undefined);
              controller.close();
            } catch (cause) {
              const message = cause instanceof Error ? cause.message : "A képgenerálás megszakadt.";
              await settleJob(message);
              controller.error(cause);
            }
          },
          async cancel(reason) {
            await reader.cancel(reason);
            await settleJob("A képgenerálás megszakadt.");
          },
        });
        return new Response(streamBody, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});

