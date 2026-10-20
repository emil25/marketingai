# MarketingPilot zárt béta – indítás és ellenőrzés

## Változások és korlátok

A jelenlegi React/TanStack Start UI és a domain store változatlan alapokon marad.
Az új fiók e-mail-megerősítést kap; a 24 órás token csak SHA-256 hashként marad
a szerveren. A reset token 30 perces és egyszer használható. Jelszócsere és reset
emeli a session verzióját, így a régi cookie-k nem használhatók tovább.
Korábbi, auth metaadat nélküli fiókok kompatibilitási okból megerősítettnek
számítanak; ez nem bizonyítja, hogy korábban e-mailt kaptak.

Regisztráció/login/reset sebességkorlát PostgreSQL-ben tartós, atomi számlálóval
működik; a JSON fixture külön fájlt használ. Turnstile token a szerveren is
ellenőrződik, beleértve a műveletet és a canonical hostot. Más reverse proxy
esetén a megbízható IP fejlécet külön kell konfigurálni; önkényes X-Forwarded-For
fejlécet nem fogadunk el. E-mail-alapú korlát minden környezetben van.

A posztot a felhasználó másolja ki. A **Közzétettem** kézi jelölés ténylegesen
mentődik és megjelenik a naptárban, külső platformazonosítót nem talál ki.
Hiányzó helykitöltővel sem kész állapot, sem ütemezés, sem kézi közzétett jelölés
nem engedélyezett. A naptár dátuma nem automatikus publikálási ígéret.

Új kampány csak az összes hét sikeres validálása után jön létre. Megszakadt
generálás az AI jobban marad, heti részeredménnyel és újrapróbálási lehetőséggel.
Nem keletkezik új üres kampány. Régi üres, hibás próbálkozások helyett a
próbálkozás jelenik meg. Valódi kézi piszkozatokat nem törlünk automatikusan.

Export: saját workspace-ekhez hozzáférhető üzleti tartalom JSON-ban; nincs benne
jelszólenyomat, OAuth token/state vagy nyers AI job. Törlés: jelszó + TÖRLÉS,
azonnali fiókzárolás, médiafájlok eltávolítása, saját domainrekordok és AI
hívásnapló törlése, session megszüntetése. Közösen használt saját workspace esetén
előbb tulajdonjogátadás kell; más tag adatait nem töröljük. Átmeneti médiahiba
után a törlés új belépéssel az `/account-deletion` oldalon folytatható.
A JSON fixture új rekordjainál is ellenőrizzük a parenteket, így törlés után
futó késői AI-mentés nem hozhat létre árva tartalmat.

## Szükséges szerverbeállítások

Titkot csak szolgáltatói secret store-ban tárolj, ne Gitben, ticketben vagy
képernyőképen. A `.env.example` tartalmazza a neveket.

| Csoport | Kötelező beállítás |
| --- | --- |
| Adatbázis | DATABASE_URL; migrációhoz DIRECT_URL vagy DATABASE_URL_UNPOOLED; TLS |
| Session | SESSION_SECRET legalább 32 véletlen karakter |
| Domain | PUBLIC_APP_URL a canonical HTTPS origin |
| Üzemeltető | OPERATOR_NAME, OPERATOR_EMAIL, OPERATOR_ADDRESS valós, nyilvános adatok |
| E-mail | RESEND_API_KEY; EMAIL_FROM hitelesített feladói domain |
| Visszaélésvédelem | TURNSTILE_SITE_KEY; TURNSTILE_SECRET_KEY; engedélyezett preview/production domain |
| Szöveges AI | OPENROUTER_API_KEY és használható kredit; AI_DAILY_CALL_LIMIT |
| Média | MEDIA_STORAGE=vercel-blob és privát Blob jogosultság |
| Meglévő titkos csatornatárolás | CHANNEL_TOKEN_ENCRYPTION_KEY |

Az OPERATOR_* és szolgáltatói beállítások hiánya letiltja a production
regisztrációt. Ez szándékos, nem regisztrációs hiba. A jogi tájékoztatók
tervezetek; végleges szövegük jogászi jóváhagyást igényel.

## Neon ág, mentés és migrációs sorrend

1. A production Neon projektről készíts szolgáltatói restore pontot/mentést.
2. Hozz létre elkülönített fejlesztői/preview ágat; a preview soha ne kapja a
   production kapcsolatát. Ügyféladatot használó branch hozzáférése is privát.
3. Ezen az ágon futtasd `npm run db:migrate` parancsot. A runner sorban,
   tranzakcióban alkalmazza: 001 → 002 → 003 → 004 → **005** → **006**.
   A 005 AI-naplót és a 006 auth metaadatot/rate limitet itt próbáld ki először.
4. Ha kell helyi adatok költöztetése: mentés + eredeti JSON hash, majd kizárólag
   üres, jóváhagyott célba `npm run db:migrate:json`. Meglévő adatnál leáll.
   Üresen induló bétához nem kell import. Az eredeti JSON-t nem töröljük.
5. Ellenőrizd a sémaverziókat, foreign key-eket, a megmaradt AI-naplót, majd
   signup → verification → post → campaign → calendar → account workflow.
6. Csak sikeres ágteszt és mentés után alkalmazd ugyanazokat a migrationöket
   productionben, és kapcsold az új buildet a már frissített adatbázisra.

Ebben a munkamenetben nem volt DATABASE_URL/DIRECT_URL, Neon CLI-hozzáférés vagy
bejelentkezett Neon böngésző. Ezért sem 005/006 éles futtatása, sem PostgreSQL
workflow nem állítható igazoltnak. A JSON fixture nem helyettesíti ezt az átvételt.

## Build és automatikus QA

```sh
npm ci
npx playwright install chromium webkit
npm run build
npm run build:node
npx tsc --noEmit
npm test
npm run test:e2e
node tests/production-smoke.mjs
```

PostgreSQL az alapértelmezés. JSON csak MARKETINGPILOT_JSON_FIXTURE=true explicit fejlesztői fixture-ként fut; productionben ezt a kapcsolót is elutasítjuk. A meglévő helyi JSON megmarad, de nem használjuk csendes adatbázis-helyettesítőként.

A Playwright saját 8087 portot és külön, gitignore-olt fixture-t használ.
A production smoke a Node build után saját 8090-es porton indul, nem ír
adatbázist vagy ügyféladatot, és a végén leállítja a saját szervert.
A provider mock kizárólag tesztpreload, nincs az alkalmazásba beépített AI/auth
kerülőút. Valós szerverfunkciók, cookie-k, hash tokenek és fájlmentések futnak;
csak a külső Resend/OpenRouter válasz szimulált. A privát teszt outbox tokeneket
tartalmaz, nem kerülhet a dokumentációba/Gitbe. Minden tesztfiók TESZT jelölésű.

Képernyőképek: `docs/qa/screens`. Reszponzív találatok: `docs/qa/*-beta-responsive.json`.
HTML/trace: `outputs/beta-e2e-report` és `outputs/beta-e2e-results` (privát,
nem feltöltendő). A képernyőképek mesterséges teszttartalmat mutatnak.

## Vercel preview és production aktiválás

- A previewhoz külön Neon ág, privát médiatár és külön Turnstile domain kell.
- A build előtt a migration legyen kipróbálva a preview ágon. A jelenlegi Vercel
  build runner migrációt is futtat: ezért a célkapcsolatot külön ellenőrizni kell.
- Vercel preview készítése: `npm run build:vercel`, majd jóváhagyott preview
  deployment. Production promotion csak a preview teljes átvétele után.
- `/api/health`: 200 csak használható store mellett; production DB hiányában
  503. Nem ad vissza secretet vagy szolgáltatói hibaüzenetet.
- Valós e-mail kézbesítés/feladó, Turnstile challenge és PostgreSQL teszt
  szükséges, mielőtt ismeretlen felhasználót hívsz be. Mock QA ezt nem bizonyítja.
- A régi production appra nem kerültek ki ezek a helyi módosítások; nincs
  automatikus commit/push vagy production promotion.

## Napló és megőrzés

Az AI hívásmetaadat: user/workspace/brand azonosító, modell, művelet, idő, státusz,
szolgáltatói tokenszám/költség. Nincs prompt, válasz vagy kulcs. A 90 napnál régebbi
bejegyzések a következő foglaláskor törlődnek; inaktív rendszerhez üzemeltetői
napi karbantartás kell, ha szigorú naptári törlési határidőt vállalsz.
Fióktörlés a saját AI auditot is törli. Az üzleti AI job a szerkeszthető tartalom
része, eltér az operatív hívásnaplótól, exportba nyers formában nem kerül.
402-es szolgáltatói hiba külön strukturált operátori esemény. A szerverhibanapló
csak kódot/eseményt ír, request body-t és nyers exceptiont nem.

## Külső függőség

OpenRouter kredit, hitelesített Resend feladó/fiók, Turnstile fiók/domain,
üzemeltetői adatok és végleges jogi szöveg, Neon ág/mentés és Vercel preview.
Meta OAuth és AI képgenerálás e körön kívül marad. Automatikus publikálás nem
feltétele a kézi munkafolyamatot használó zárt bétának.
