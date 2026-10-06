import { createFileRoute } from "@tanstack/react-router";
import { PublicInfoPage } from "@/components/public-info-page";
import { getPublicOperator } from "@/lib/public-site.functions";
export const Route = createFileRoute("/contact")({
  loader: () => getPublicOperator(),
  head: () => ({ meta: [{ title: "Kapcsolat és üzemeltető — MarketingPilot" }] }),
  component: Contact,
});
function Contact() {
  const operator = Route.useLoaderData();
  return (
    <PublicInfoPage
      title="Kapcsolat és üzemeltető"
      subtitle="Kérdésed van, hibát jeleznél vagy adatkezelési kérést küldenél?"
    >
      <section>
        <h2>Ki áll a MarketingPilot mögött?</h2>
        <p>
          {operator.about ||
            "A MarketingPilot kisvállalkozásoknak készülő marketing-munkatér: az AI-t és a szerkeszthető tartalmakat egy helyen kapcsolja össze. Az üzemeltető bemutatkozása előkészítés alatt áll."}
        </p>
      </section>
      <section className="rounded-2xl border bg-card p-6">
        <h2>Üzemeltetői adatok</h2>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm text-muted-foreground">Név / cégnév</dt>
            <dd>{operator.name || "Még nincs közzétett üzemeltetői név."}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Cím / székhely</dt>
            <dd>{operator.address || "Még nincs közzétett cím."}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd>
              {operator.email ? (
                <a href={`mailto:${operator.email}`}>{operator.email}</a>
              ) : (
                "A kapcsolattartási email-cím még nincs közzétéve."
              )}
            </dd>
          </div>
        </dl>
      </section>
      {operator.email ? (
        <section>
          <h2>Írj nekünk</h2>
          <p>
            <a href={`mailto:${operator.email}?subject=MarketingPilot%20megkeres%C3%A9s`}>
              Email küldése
            </a>
          </p>
          <p className="mt-2">
            Hibajelzéshez írd meg az oldal nevét és a hibaüzenetet. Jelszót, API-kulcsot vagy más
            titkot ne küldj.
          </p>
        </section>
      ) : (
        <p role="note">
          A kapcsolatfelvétel még nem aktív. Nincs olyan űrlap, amely elküldöttnek mutatna egy
          valójában nem továbbított üzenetet.
        </p>
      )}
    </PublicInfoPage>
  );
}
