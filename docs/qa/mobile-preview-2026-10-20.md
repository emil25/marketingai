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
