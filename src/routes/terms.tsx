import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDraftNotice, PublicInfoPage } from "@/components/public-info-page";
export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Használati feltételek — MarketingPilot" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: Terms,
});
function Terms() {
  return (
    <PublicInfoPage
      title="Használati feltételek"
      subtitle="Béta használati tájékoztató · Frissítve: 2026. október 6."
    >
      <LegalDraftNotice />
      <section>
        <h2>Mire használható a MarketingPilot?</h2>
        <p>
          Marketingtartalmak tervezésére, AI-val történő előkészítésére, szerkesztésére és
          tárolására. Saját munkatér, márkahang, platformváltozatok, kampány és tartalomnaptár
          kapcsolódik össze. Ez jelenleg béta szolgáltatás; nem vállalunk garantált elérést,
          értékesítési eredményt vagy megszakítás nélküli rendelkezésre állást.
        </p>
      </section>
      <section>
        <h2>Előfizetés és fizetés</h2>
        <p>
          A bétában jelenleg nincs fizetési integráció vagy megvásárolható előfizetés.
          Regisztrációkor nem kérünk bankkártyát és nem indítunk automatikus terhelést. Az AI
          szolgáltatások rendelkezésre állását külső keretek és kreditek befolyásolhatják. A
          díjmentes béta nem jelent örök ingyenességi vagy korlátlan AI-használati ígéretet.
        </p>
      </section>
      <section>
        <h2>AI-tartalom és saját média</h2>
        <p>
          Közzététel előtt ellenőrizd a tényeket, árakat, dátumokat, nyelvezetet és a felhasználási
          jogokat. Csak olyan képet, szöveget vagy saját posztpéldát adj meg, amelynek használatára
          jogosult vagy. Az AI válasza hibás vagy hiányos is lehet; a szerkesztőben javíthatod, és a
          szöveget másolhatod vagy mentheted.
        </p>
      </section>
      <section>
        <h2>Publikálás és időzítés</h2>
        <p>
          A Facebook és Instagram közvetlen publikálása csatlakoztatott fiókot és megfelelő
          Meta-jogosultságokat igényel; az online bétában jelenleg nem tekinthető általánosan
          elérhetőnek. Más platformokra a tartalom előkészítése és másolása érhető el. A naptárban
          mentett időpont önmagában nem indít háttérben automatikus publikálást.
        </p>
      </section>
      <section>
        <h2>Fiók és adatok</h2>
        <p>
          Őrizd meg a belépési adataidat, és saját vállalkozásod munkaterében dolgozz. A tartalmaid
          nem nyilvános posztok attól, hogy elmented őket. Az adatkezelésről az{" "}
          <Link to="/privacy">Adatvédelem</Link> oldalon olvashatsz. A végleges szerződéses
          feltételek és kapcsolattartás még előkészítés alatt állnak.
        </p>
      </section>
    </PublicInfoPage>
  );
}
