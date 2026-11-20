# Mobile simple-mode release candidate — 2026-10-20

- Based on `codex/gemini-preview` at `4cf8adc`; the existing landing social carousel and Gemini support were retained.
- Includes the previously local simple/detailed UI, account preferences, ownership checks, bounded AI audit layer, and mobile first-post touch-target fixes.
- Quick idea buttons show their selected state. Idea and primary result buttons are at least 44 px high.
- The existing onboarding e2e selector now uses the current Hungarian settlement label. Screenshot/report directories can be overridden to keep previous QA artifacts intact.
- Original working copy: 180 unit tests, TypeScript and build passed. Chromium signup / first post / copy / autosave / weekly plan / responsive UI test passed with mocked AI and email.
- Combined Preview candidate: 181 unit tests, TypeScript, Vercel build and migration-sequence check passed.
- A pre-existing provider test was updated to assert the new authenticated-request boundary; unauthenticated text/image requests must not contact a provider. Gemini request-body unit coverage remains in `tests/ai-token-budget.test.ts`.
- Vercel's existing Neon integration was verified to belong to `marketingai`. Automatic database branching was enabled for Preview only and the persisted setting was checked. Production branching remains disabled.
- No production schema migration or local JSON import was performed. Local user data, secrets, outputs and unreviewed QA screenshots are excluded from this candidate.
- Live Preview migrations, browser verification and real-provider verification remain separate deployment steps; a successful local build is not evidence that these have run.

## Rövid első belépés — 2026-10-20

- Az első lépésen csak a vállalkozás neve és a kínálat kötelező; a település megadható, minden további márkaadat később szerkeszthető. A vállalkozástípust induláskor nem kell kiválasztani; az új profil biztonságos általános típussal indul.
- A következő lépés a fiók létrehozása, utána közvetlenül az első poszt készítése. A régi onboarding-piszkozat szöveges adatai megmaradnak: a céges adatok oldalára térnek vissza, ha még hiányoznak; a már fiókhoz jutott piszkozat a fióklépésre kerül.
- Chromium e2e: regisztráció → első poszt → másolás → szerkesztés → újratöltés után a mentett szöveg visszaolvasása → heti terv; a reszponzív és akadálymentességi ellenőrzések is lefutottak. A teszt mockolt AI-t és e-mailt használ.
- Ellenőrzés: 181/181 egységteszt, TypeScript és build PASS; Playwright chromium teszt PASS. Akadálymentességi ellenőrzés: nincs WCAG 2.1 A/AA találat (`chromium-ui-modes-accessibility.json`).
- Nem történt éles adatbázis-módosítás, valódi e-mail-küldés vagy valódi AI-hívás. A production oldalt nem módosítottuk.

## Regisztrációs állapot egyértelműsítése — 2026-10-20

- Zárt regisztrációnál az űrlap és a letiltott gomb helyett világos üzenet jelenik meg Belépés és Kapcsolat gombbal. A szöveg elmagyarázza, hogy a regisztráció nincs bekapcsolva; a beállítás nem változott.
- Ha a regisztráció állapotát nem sikerül lekérni, külön hibaüzenet és Újrapróbálás, Belépés, valamint Kapcsolat lehetőség jelenik meg.
- A production smoke ellenőrzi a zárt állapot üzenetét és a Kapcsolat hivatkozást. A célzott Playwright ellenőrzés a `tests/e2e/registration-closed.spec.ts` fájlban van, de helyi futtatása a `127.0.0.1:8087` hálózati `EACCES` tiltás miatt nem sikerült.
- Ellenőrzés: 181/181 egységteszt, TypeScript, érintett fájlok lintje, normál build és Vercel build sikeres. A helyben előállított Vercel-konfiguráció pontosan egy `0 6 * * *` ütemezést tartalmaz az `/api/cron/ai-monitor` útvonalra.
- Nem történt Vercel-módosítás, éles adatbázis-migráció vagy valódi szolgáltatói hívás. A Vercel felületén látható korábbi duplikáció a helyi csomagban nem reprodukálható; a végső Preview telepítéskor még ellenőrizni kell, hogy nincs-e külön, projektbeállításból származó második Cron bejegyzés.
