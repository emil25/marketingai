import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalDraftNotice, PublicInfoPage } from "@/components/public-info-page";
import { brandForLocale, DEFAULT_MARKET_LOCALE } from "@/config/brand";
const productName = brandForLocale(DEFAULT_MARKET_LOCALE).productName;
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: `Adatvédelem — ${productName}` },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: Privacy,
});
function Privacy() {
  return (
    <PublicInfoPage
      title="Adatvédelem"
      subtitle="A jelenlegi béta adatkezelése · Frissítve: 2026. október 16."
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
          tárolja. AI-generáláskor az ötlet és a releváns márkakontextus ahhoz a modellszolgáltatóhoz
          kerül, amelyet az alkalmazás üzemeltetője beállított. OpenRouter használatakor a kérés az
          OpenRouteren és a kiválasztott modellen keresztül jut el a modellszolgáltatóhoz; közvetlen
          Gemini-beállításnál a Google Gemini API kapja meg. Bizalmas ügyféladatot vagy különleges
          személyes adatot ne adj meg a generáláshoz.
        </p>
        <p>
          Ha a Gemini API-t használjuk, az éles alkalmazásban csak aktív Google Cloud Billinggel
          rendelkező projekthez kötött, fizetős API-szolgáltatás használható. A Google feltételei
          szerint az EGT-ben elérhető API-kliens csak fizetős szolgáltatást tehet elérhetővé. Az
          ingyenes kvóta kizárólag belső próbára, kitalált adatokkal használható. A Google a
          fizetős Gemini API-nak küldött promptokat és az arra adott válaszokat adatfeldolgozóként,
          az adatfeldolgozási kiegészítés szerint kezeli, és nem használja termékfejlesztésre. A
          Google korlátozott ideig naplózhatja ezeket a tartalmakat a tiltott használat
          felismerésére és megelőzésére, a szolgáltatás biztonsága érdekében, valamint a szükséges
          jogi vagy hatósági közzétételekhez. A tartalom átmenetileg bármely olyan országban
          tárolható vagy gyorsítótárazható, ahol a Google vagy megbízottjai létesítményt tartanak
          fenn; ez nemzetközi adattovábbítást jelenthet. Ez a leírás a promptokra és válaszokra
          vonatkozik; más fiók-, számlázási és használati adatokra külön Google-feltételek
          vonatkozhatnak.{" "}
          <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noreferrer">
            A Gemini API aktuális feltételei
          </a>
          {" · "}
          <a href="https://business.safety.google/processorterms/" target="_blank" rel="noreferrer">
            Google adatfeldolgozási kiegészítés
          </a>
          . A Google feltételei és a beállítások változhatnak; a végleges tájékoztatót jogásszal
          kell jóváhagyatni.
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
        <h2>AI-hívásnapló és e-mail</h2>
        <p>Az AI-hívások működési naplója a felhasználó, vállalkozás és márka azonosítóját, a műveletet, modellt, tokenszámot, költséget (ha a szolgáltató visszaadja), időpontot, időtartamot és hibakódot tartalmazza. Ebbe a naplóba prompt és AI-válasz nem kerül. A kért tartalmak és a folytatható generálási munkák adatai ettől külön, a saját munkateredben tárolódnak.</p>
        <p>A megerősítő és jelszó-visszaállító e-mailt a Resend kézbesíti. Ehhez a címzett e-mail-címét és az egyszer használható hivatkozást kapja meg. A Cloudflare Turnstile a visszaélések elleni ellenőrzést végzi.</p>
      </section>
      <section>
        <h2>Megőrzés és törlés</h2>
        <p>
          A tartalmakat új belépés után is betöltjük, a posztok és média törölhetők a felületükön. A
          teljes fiók törlése és az adatexport a Beállításokban érhető el. A törlés megszünteti a munkamenetek érvényességét, törli a saját vállalkozások tartalmait, médiáját és AI-hívásnaplóját. Közös vállalkozásnál előbb a tulajdonjogot kell rendezni. Sikertelen médiatörlésnél a fiók zárolva marad és a művelet újrapróbálható. Az AI-hívásnapló tervezett megőrzési ideje 90 nap; a lejárt bejegyzéseket a következő AI-művelet takarítja ki. Inaktív rendszerben a pontos törlési határidőhöz napi üzemeltetői takarítás szükséges, ezt indulás előtt be kell állítani. Az e-mail-megerősítő hivatkozás 24 óráig, a jelszó-visszaállító hivatkozás 30 percig érvényes, és egyszer használható. A szolgáltatói biztonsági mentések megőrzési és törlési rendjét az indulás előtt véglegesíteni kell az üzemeltetővel.
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
