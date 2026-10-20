import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          if (process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim()) {
            const { getPool } = await import("@/lib/server/postgres-store.server");
            await getPool().query("SELECT 1");
          } else if (process.env.NODE_ENV === "production")
            return Response.json(
              { status: "not_ready" },
              { status: 503, headers: { "Cache-Control": "no-store" } },
            );
          else {
            const { readData } = await import("@/lib/server/store.server");
            await readData();
          }
          return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
        } catch {
          console.error(JSON.stringify({ event: "health_failed", code: "STORAGE_UNAVAILABLE" }));
          return Response.json(
            { status: "not_ready" },
            { status: 503, headers: { "Cache-Control": "no-store" } },
          );
        }
      },
    },
  },
});
