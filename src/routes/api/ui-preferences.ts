import { createFileRoute } from "@tanstack/react-router";
import { getOptionalAuthContext } from "@/lib/server/auth-context.server";
import { readData, transact } from "@/lib/server/store.server";
import { UiPreferencesSchema, uiPreferences } from "@/lib/ui-mode";
const headers = { "Cache-Control": "no-store" };
async function handle(request?: Request) {
  try {
    const context = await getOptionalAuthContext();
    if (!context)
      return Response.json({ error: "Bejelentkezés szükséges." }, { status: 401, headers });
    if (!request) {
      const user = (await readData()).users.find((item) => item.id === context.user.id);
      if (!user) return Response.json({ error: "Jelentkezz be újra." }, { status: 401, headers });
      return Response.json(uiPreferences(user), { headers });
    }
    const input = UiPreferencesSchema.safeParse(await request.json().catch(() => null));
    if (!input.success)
      return Response.json({ error: "Érvénytelen felületbeállítás." }, { status: 400, headers });
    const saved = await transact((db) => {
      const user = db.users.find((item) => item.id === context.user.id);
      if (!user || user.auth?.deleting) throw new Error("Jelentkezz be újra.");
      if (input.data.ui_mode !== undefined) user.uiMode = input.data.ui_mode;
      if (input.data.suggestionDismissed !== undefined)
        user.uiModeSuggestionDismissed = input.data.suggestionDismissed;
      return uiPreferences(user);
    });
    return Response.json(saved, { headers });
  } catch {
    return Response.json(
      { error: "Nem sikerült elérni a beállítást. Próbáld újra később." },
      { status: 503, headers },
    );
  }
}
export const Route = createFileRoute("/api/ui-preferences")({
  server: {
    handlers: {
      GET: () => handle(),
      PUT: ({ request }) => handle(request),
    },
  },
});
