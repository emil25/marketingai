import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDraftNotice, PublicInfoPage } from "@/components/public-info-page";
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Adatvédelem — MarketingPilot" },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: Privacy,
});
function Privacy() {
  return (
    <PublicInfoPage
      title="Adatvédelem"
      subtitle="A jelenlegi béta adatkezelése · Frissítve: 2026. október 6."
    >
      <LegalDraftNotice />
      <section>
        <h2>Kihez tartozik az adatkezelés?</h2>
        <p>
          Az üzemeltető nyilvános adatait és elérhetőségét a{" "}
          <Link to="/contact">Kapcsolat oldalon</Link> találod. A hiányzó adatok véglegesítéséig ez
          az oldal nem tekinthető teljes jogi tájékoztatónak.
        </p>
      </section>
      <section>
        <h2>Milyen adatokat használ az alkalmazás?</h2>
        <ul>
          <li>
            Fiók: email-cím, megadott név és jelszólenyomat. A jelszót nem egyszerű szövegként
            tároljuk.
          </li>
          <li>
            Munkatér és márka: vállalkozás adatai, célközönség, nyelv, hangnem és a megadott saját
            posztpéldák.
          </li>
          <li>
            Tartalom: briefek, posztok, változatok, verziók, kampányok, tervtételek és feltöltött
            média.
          </li>
          <li>
            Működési adatok: AI-műveletek állapota, hibák, és csatornacsatlakoztatás esetén a
            kapcsolat adatai. A szerveroldali tokenek nem kerülnek a nyilvános felületre.
          </li>
        </ul>
      </section>
      <section>
        <h2>Mire használjuk?</h2>
        <p>
          A belépéshez, a saját munkatered betöltéséhez, a tartalom megőrzéséhez és a kért
          AI-műveletek elvégzéséhez. A posztszövegek és képek ellenőrzése a felhasználó feladata. A
          műveletek naplója a hibakeresést is segíti.
        </p>
      </section>
      <section>
        <h2>AI és külső szolgáltatók</h2>
        <p>
          A webalkalmazás Vercelen fut, az online adatokat Neon PostgreSQL és privát Vercel Blob
          tárolja. AI-generáláskor a brief és a releváns márkakontextus az OpenRouterhez és az
          általa használt modellszolgáltatóhoz kerül. Bizalmas ügyféladatot vagy különleges
          személyes adatot ne adj meg a generáláshoz. A szolgáltatók adatfeldolgozási és nemzetközi
          adattovábbítási feltételeinek felülvizsgálata még szükséges.
        </p>
      </section>
      <section>
        <h2>Sütik és külső betöltések</h2>
        <p>
          A bejelentkezési munkamenethez szükséges, httpOnly sütit használunk, legfeljebb 30 napos
          élettartammal. Kijelentkezéskor az alkalmazás törli ezt a sütit. A betűkészlet a Google
          Fonts szolgáltatásából töltődik be; a tárhelyszolgáltató működési naplókat is kezelhet.
        </p>
      </section>
      <section>
        <h2>Megőrzés és törlés</h2>
        <p>
          A tartalmakat új belépés után is betöltjük, a posztok és média törölhetők a felületükön. A
          teljes fiók törlése, a mentések megőrzési ideje és az adatkezelési kérelmek folyamata még
          nincs véglegesítve. Nem állítjuk, hogy minden adat automatikusan törlődik egy
          meghatározott idő elteltével.
        </p>
      </section>
      <section>
        <h2>Adatvédelmi jogaid</h2>
        <p>
          A rád alkalmazandó szabályok szerint kérhetsz hozzáférést, helyesbítést, törlést,
          korlátozást vagy adathordozhatóságot, és panasszal élhetsz az illetékes felügyeleti
          hatóságnál. A részleteket az{" "}
          <a
            href="https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en"
            target="_blank"
            rel="noreferrer"
          >
            Európai Bizottság tájékoztatója
          </a>{" "}
          ismerteti. A kérelmekhez szükséges működő üzemeltetői kapcsolat véglegesítése
          elengedhetetlen.
        </p>
      </section>
    </PublicInfoPage>
  );
}
