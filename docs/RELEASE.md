# MarketingPilot – kiadási ellenőrzőlista

Ez üzemeltetési útmutató, nem annak állítása, hogy az alábbi külső próbák már lefutottak.
Az aktuális helyi ellenőrzés eredménye: `docs/qa/release-safety-2026-10-08.md`.
Ne kerüljön kulcs, jelszó, adatbázis-URL, süti vagy ügyféladat a repóba és a jelentésekbe.

## 1. Környezeti változók (csak nevek)

Mindig az adott Vercel környezet titkos beállításaiban, külön Preview / Production értékekkel.
Részletes kommentek: `.env.example`.

| Terület | Változók |
| --- | --- |
| Adatbázis | `DATABASE_URL`, `DIRECT_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_SSL`, `DATABASE_POOL_MAX` |
| Futás és munkamenet | `NODE_ENV`, `SESSION_SECRET`, `PUBLIC_APP_URL`; Node tárhelyen `PORT`, `HOST`; Vercel biztosítja `VERCEL`, `VERCEL_ENV` |
| Privát képek | `MEDIA_STORAGE`, `BLOB_STORE_ID`, `BLOB_READ_WRITE_TOKEN`; opcionálisan `MEDIA_PUBLIC_BASE_URL` |
| Szöveges AI | `AI_TEXT_PROVIDER`, `OPENROUTER_API_KEY`, `OPENROUTER_TEXT_MODEL`, `GEMINI_API_KEY`, `GEMINI_TEXT_MODEL`, `AI_DAILY_CALL_LIMIT` |
| Üzemeltetési riasztás | `CRON_SECRET`, `AI_MONITOR_CREDITS_THRESHOLD_USD`, `AI_MONITOR_402_THRESHOLD`, `AI_MONITOR_429_THRESHOLD`, `AI_MONITOR_TIMEOUT_THRESHOLD`; opcionális `OPENROUTER_MANAGEMENT_API_KEY` |
| Csak opcionális elkülönített build-migráció | `MIGRATE_ON_BUILD`, `PREVIEW_DATABASE_TARGET_SHA256`, `PRODUCTION_DATABASE_TARGET_SHA256` |
| Opcionális AI kép | `OPENROUTER_IMAGE_MODEL` |
| Regisztráció, levelek, botvédelem | `RESEND_API_KEY`, `EMAIL_FROM`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `OPERATOR_NAME`, `OPERATOR_EMAIL`, `OPERATOR_ADDRESS` |
| Meghívásos zárt béta | `BETA_MODE` (`private` vagy `off`), `BETA_INVITE_CODE` (kizárólag titkos szerverbeállítás) |
| Opcionális heti emlékeztető | `WEEKLY_REMINDERS_ENABLED`, `WEEKLY_REMINDER_TIMEZONE` |
| Nyilvános bemutatkozás, régi kompatibilis mezők | `PUBLIC_OPERATOR_ABOUT`, `PUBLIC_OPERATOR_NAME`, `PUBLIC_OPERATOR_ADDRESS`, `PUBLIC_CONTACT_EMAIL` |
| Később Meta | `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_GRAPH_VERSION`, `META_OAUTH_SCOPES`, `CHANNEL_TOKEN_ENCRYPTION_KEY` |
| Opcionális videós Node környezet | `FFMPEG_PATH`, `VIDEO_FONT_PATH` |
| Csak fejlesztői fixture / engedélyezett egyszeri import | `MARKETINGPILOT_JSON_FIXTURE`, `MARKETINGPILOT_DATA_DIR`, `MARKETINGPILOT_IMPORT_BLOB_PATH` |
| Csak helyi admin gyorsbelépés | `ENABLE_LOCAL_ADMIN_LOGIN`, `LOCAL_ADMIN_USER_ID`, `LOCAL_ADMIN_WORKSPACE_ID` |
| Csak elkülönített Preview-teszt | `MARKETINGPILOT_PREVIEW_TEST_AI`, `MARKETINGPILOT_PREVIEW_TEST_EMAIL` |
| Csak tesztfuttató, nem kliensbe építve | `BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_PREVIEW_ACK`, `VERCEL_AUTOMATION_BYPASS_SECRET` |

- Production: PostgreSQL, privát Blob, HTTPS, hosszú véletlen session titok; JSON fixture és helyi admin kikapcsolva.
- `BETA_MODE=off`: a production regisztráció az üzemeltető, levél és botvédelmi konfiguráció hiányában letiltott.
- `BETA_MODE=private`: a meghívókódot a szerver ellenőrzi; hiányzó kódbeállításnál a regisztráció zárva marad.
  A meghívott fiók használhat AI-t e-mail-megerősítés nélkül, de az e-mail nem válik ellenőrzötté.
  A kód nem kerül kliensbe, adatbázisba, naplóba vagy a repóba. Az auth limit és CSRF-védelem megmarad.
  A mód kikapcsolása után a még nem megerősített fiókoknak valódi e-mail-megerősítés szükséges az AI-hoz.
  Productionben sem a meghívásos béta, sem a kód nem oldja fel a PostgreSQL/HTTPS/session/testflag indulási védelmeket.
- Beállítatlan levelezésnél productionben nincs használhatatlan jelszó-visszaállító link; a közvetlen oldal „Hamarosan” állapotot ad.
  A fejlesztői levélkimenet csak helyi, nem-production futásban használható; Vercelen tiltott.
- A fő csatorna vállalkozásonként a `brand_profiles.main_channel` mezőben van; nem környezeti változó.
- A nyilvános URL nem tartalmazhat jelszót, és nem lehet localhost.
- Az indulási ellenőrzés `NODE_ENV=production` **vagy** `VERCEL_ENV=production` esetén kötelező.
  Tiltott a helyi admin, a teszt-AI és a JSON fixture; legalább 32 karakteres session titok,
  `DATABASE_URL` és nyilvános HTTPS origin kell. A hibában csak változónevek szerepelnek.
  A Nitro induláskor ellenőriz; a közvetlen TanStack szerverbelépési pont is védett.

## 2. Mentés és migráció

- [ ] Jegyezd fel a jelenlegi production telepítés azonosítóját és a forrásverziót.
- [ ] Készíts visszaállítható Neon mentést/ágat; ellenőrizd az elérhető megőrzési időt.
- [ ] Külön privát adatbázis-mentés és Blob-visszaállítási terv is legyen; teszteld a visszatöltést külön ágon.
- [ ] A helyi JSON eredetit tartsd meg, ellenőrzőösszeggel; ne töltsd fel GitHubra.
- [ ] Ellenőrizd, melyik adatbázist célozza a migráció (értékek kiírása nélkül).

Futtatás, először kizárólag a próbaágon:

```sh
npm run db:migrate
```

A runner a `_marketingpilot_migrations` táblában követi a sorrendet; már alkalmazott fájlt kihagy.
Egy fájl tranzakcióban fut. A sorrend:

1. `001_initial.sql`
2. `002_scope_integrity.sql`
3. `003_business_type.sql`
4. `004_content_quality.sql`
5. `005_ai_calls.sql`
6. `006_beta_auth.sql`
7. `007_ui_mode.sql`
8. `008_main_channel.sql`
9. `009_operations_monitor.sql`
10. `010_transylvania_market.sql`
11. `011_approved_claims.sql`
12. `012_idea_bank.sql`

Ellenőrizd a fájlneveket és a sorszámok folytonosságát a migráció előtt:

```sh
npm run db:check-migrations
```

Az új 007/008/009 additív. A 009 csak szerveroldali napi monitor-zárolást és
összesített jelentést tárol, ügyfélszöveget nem. Ne szerkessz már alkalmazott migrációt,
ne DROP-pal állíts vissza. **Production build soha nem migrál és nem importál.**
Productionben a `db:migrate` külön, ellenőrzött kiadási lépés, mentés után.
Az explicit környezeti kapcsolat elsőbbséget élvez: ha `DATABASE_URL` vagy
`DIRECT_URL` már be van adva (vagy Vercelben fut), a migrációs runner nem tölti
ki a hiányzó kapcsolatot helyi `.env`-ből. A hibákból sem ír ki SQL-értéket vagy URL-t.
JSON import **csak engedélyezett, üres célba**, ha valóban szükséges:

```sh
npm run db:migrate:json
```

Az import megakadályozza a meglévő rekordok felülírását. A production indulás korábbi döntése szerint
üres adatbázissal történik; a helyi fiókokat ne importáld automatikusan.
`MARKETINGPILOT_IMPORT_BLOB_PATH` maradjon üres, ha nincs kifejezetten jóváhagyott import.

## 3. Neon próbaág és Vercel Preview

- [ ] Elkülönített Neon ág/adatbázis tesztfiókkal; lehetőleg csak séma és TESZT adatok.
  A production ágból másolt ügyféladat továbbra is bizalmas adat.
- [ ] A Preview `DATABASE_URL` és migrációs kapcsolat csak ezt az ágat célozza.
  Alapértelmezetten a build itt sem migrál: a `npm run db:migrate` külön lépés.
- [ ] Külön privát Blob és session titok; Preview levelek csak engedélyezett tesztcímekre.
- [ ] Turnstile tesztkulcsokat kizárólag Previewban használj a böngészős próbához.
- [ ] Vercel előnézeti telepítés a kijelölt projektbe, `npm run build:vercel` build paranccsal.
- [ ] A `PUBLIC_APP_URL` a tesztelt HTTPS-előnézet címe legyen. Ne nyilvános tesztadapter legyen az auth előtt.
- [ ] Vercel Deployment Protection esetén a tesztfuttató CI titkos bypass változója kell.
  Egyszer, csak az előnézeti originre küldjük fejlécben, átirányítás követése nélkül.
  Az így kapott böngészős süti engedi a további hozzáférést. A kulcs nem megy más weboldalra,
  képhez, fonthoz vagy átirányításhoz; nem mentünk nyomkövetést vagy hálózati felvételt.

### Böngészős próba telepített előnézet ellen

A `BASE_URL` esetén a Playwright nem indít helyi szervert. A teszt a valódi HTTP felületen keresztül,
a telepítés valódi PostgreSQL tárolójába ír. Nem olvas helyi JSON-t és nem szimulál mentést.
A helyi fixture-alapú fióktörléses tesztek nem futnak távoli címen; a csatornafolyamat és a nyilvános
oldalak ellenőrzése igen. A távoli belépéshez külön, már ellenőrzött TESZT fiók szükséges;
a jelszót a CI titoktárából add át, ne parancssorba vagy dokumentumba írd.

```sh
# BASE_URL, E2E_EMAIL, E2E_PASSWORD a tesztfuttató környezetében beállítva.
# E2E_PREVIEW_ACK=isolated-preview az elkülönített próbaadatbázis megerősítése (nem titok).
npm run test:e2e -- tests/e2e/channel-switch.spec.ts
```

Mindkét böngészőben 390 és 1280 px: első poszt → szerkesztés → Instagram → másolás → újratöltés
→ Vállalkozásom fő csatornája → visszaállítás → beállítás mentése → új poszt → Facebook.
A screenshot és a hibafájl az `outputs/` mappába kerül távoli futásnál; ügyféladat nem kerül a QA repóba.

Opcionális teszt-AI: kizárólag **nem production** `NODE_ENV`, `VERCEL_ENV=preview` és `MARKETINGPILOT_PREVIEW_TEST_AI` bekapcsolásakor,
a `MARKETINGPILOT_PREVIEW_TEST_EMAIL` alatt kijelölt, `@example.invalid` végű, TESZT nevű fiók számára.
Kizárólag a szöveges posztválasz szimulált. Auth, ownership, adatbázis, verziók, AI-napló és limit valódi.
Más felhasználók továbbra is a valódi providerhez jutnak; productionben a mock tiltott.
A szokásos production builddel készített Vercel Preview is a szigorú indulási védelem
alá esik: ott a mock legyen kikapcsolva, és a böngészős próba valódi AI-t használjon.
A mintafiók tesztadatait jelöld, ne használj valódi felhasználói fiókot.
A hitelesített tesztfiók előkészítésének parancsa: `npm run test:preview:seed`;
ehhez a próbaág DB-hozzáférése és ugyanaz az E2E_EMAIL/E2E_PASSWORD szükséges.

Helyi teljes csomag:

```sh
npm run build
npm run build:node
npx tsc --noEmit
npm test
npm run test:e2e
node scripts/qa-hygiene.mjs
```

## 4. Production aktiválás

- [ ] Ha az `AI_TEXT_PROVIDER=gemini`, ellenőrizd, hogy a `GEMINI_API_KEY` olyan Google Cloud projekthez tartozik, amelyhez aktív Cloud Billing-fiók van kapcsolva. A projekt és a kulcs összetartozását a Google AI Studio projekt-/kulcslistájában ellenőrizd; a kulcs értékét ne másold naplóba vagy dokumentumba.
- [ ] EGT-beli (így romániai) felhasználók számára a Gemini API-t csak a Google feltételei szerinti fizetős szolgáltatásként tedd elérhetővé. Ehhez az API-kulcs projektjének aktív számlázással kell rendelkeznie; ellenőrizd a projekt fizetési szintjét is.
- [ ] Állíts be Google Cloud Billing-költségkeretet és e-mailes riasztásokat a Gemini-projektre, és ellenőrizd, hogy a megfelelő címzetthez érkeznek. Az egyszerű költségkeret-riasztás figyelmeztet, de önmagában nem állítja le a számlázást; ha rendelkezésre áll és megfelelő, külön költségkorlátot is állíts be.
- [ ] A Gemini ingyenes kvótáját kizárólag kitalált tesztmárkákkal és fiktív adatokkal használd. Valódi felhasználói, üzleti, személyes vagy bizalmas adatot ne küldj ingyenes kvótán.
- [ ] A Gemini feltételeit és a Gemini adatkezeléséről szóló adatvédelmi szövegtervezetet élesítés előtt ellenőrizze jogász; a Google feltételei és szolgáltatási részletei változhatnak.
- [ ] Neon próbaág migráció, restart, visszatöltési próba és e2e eredménye dokumentálva.
- [ ] **Mock nélkül**, a productionban kiválasztott valódi AI-szolgáltatóval próba; ellenőrizd a sikeres számlálót/naplót és legalább egy valódi levélkézbesítést.
- [ ] Production env előkészítve; `MARKETINGPILOT_PREVIEW_TEST_AI` és kapcsolódó tesztmezők kikapcsolva/eltávolítva.
- [ ] Új mentés; cél ellenőrzése; külön `npm run db:migrate` a production kapcsolattal,
  a fenti sorrendben. Sikeres migráció után az új alkalmazás; `MIGRATE_ON_BUILD` üres.
- [ ] Production környezettel épített telepítés készítése; az előnézeti tesztadatbázisos telepítést
  ne irányítsd egyszerű domain-alias váltással a felhasználókra.
- [ ] Jóváhagyott production telepítés aktiválása a Vercel Deployments felületén.
- [ ] HTTPS, bejelentkezés, meglévő poszt, mód és fő csatorna, képek, ownership, API-hibák ellenőrzése.
- [ ] `docs/POST-DEPLOY.md` gyorspróba, valódi levelek és AI, napi Cron utolsó sikeres futása.
- [ ] A cégadatok és jogi oldalak véglegesítése. Meta OAuth továbbra is külön külső függőség;
  a kézi közzétételt ne nevezd automatikus posztolásnak.

## 5. Visszaállítás

1. Hiba esetén állítsd le az új aktiválást; jegyezd fel az időpontot, a safe hibatípust és a kiadást.
2. Vercelben térj vissza a korábbi, ezzel a sémával előzetesen kipróbált production verzióhoz.
   A 007/008 oszlopokat hagyd meg; a korábbi kód nem feltétlenül őrzi az új beállításokat,
   ezért kompatibilitási próba nélkül ne engedj írásokat.
3. Az alkalmazás-visszaállítás **nem** állítja vissza az adatbázist vagy Blobot.
   Ha csak alkalmazáshiba van, az újonnan mentett posztokat tartsd meg.
4. Adathiba esetén először külön Neon ágra állíts vissza mentést, ellenőrizd az eltéréseket.
   Production adatbázis visszatekerését ne végezd az azóta mentett felhasználói adatok felmérése nélkül.
5. Újratöltés, bejelentkezés, workspace/brand izoláció, posztok és képek ellenőrzése.

## 6. OpenRouter-riasztás és feladó domain

- [ ] Külön véletlen `CRON_SECRET` (32+ karakter), Resend és `OPERATOR_EMAIL` a szerver titkos beállításaiban.
- [ ] `009_operations_monitor.sql` alkalmazva; Vercel Cron aktív az éles telepítésen.
  `vercel.json`: naponta **06:00 UTC**, `GET /api/cron/ai-monitor`. Previewban nem fut automatikusan.
  A build runner a Cron-beállítást a `.vercel/output/config.json` fájlba is átviszi,
  hogy prebuilt telepítésnél se maradjon ki. Az ütemezés egyetlen forrása a `vercel.json`.
  Vercel a titkot Authorization fejlécben küldi; URL, süti és user-agent nem jogosít futtatásra.
- [ ] Küszöbök: egyenleg `< AI_MONITOR_CREDITS_THRESHOLD_USD` (alap 5 USD);
  előző gördülő 24 óra `HTTP_402 >= AI_MONITOR_402_THRESHOLD` (1),
  `HTTP_429 >= AI_MONITOR_429_THRESHOLD` (10), `TIMEOUT >= AI_MONITOR_TIMEOUT_THRESHOLD` (5).
  A napló dátumhatára UTC, a befejezés időpontjával; befejezés hiányában a kezdésével.
- [ ] Monitor a `/key` véges keretét és a `/credits` elérhető egyenlegét nézi, a kisebbet használja.
  A `/credits` management jogosultságot kérhet; ilyenkor a normál kulcs véges kerete elegendő.
  Opcionális management kulcs kizárólag szerveroldali titok. Ha egyik keret sem ellenőrizhető,
  `CREDIT_CHECK_UNAVAILABLE` riasztás jön, nem hamis egészséges állapot.
- [ ] Levél: csak kategória, darabszám és ellenőrzési időpont; nincs prompt, válasz, kulcs vagy felhasználói azonosító.
  Adatbázisos napi zárolás + mentett változatlan jelentés + Resend Idempotency-Key védi az ismétlést.
  Levélhiba: 503 és újrapróbálható futás; a napló csak biztonságos eseménynevet és időpontot tartalmaz.
- [ ] Ellenőrizd a Cron sikeres futását és egy tesztriasztás tényleges kézbesítését elkülönített ágon.
  Hibánál Vercel nem garantál automatikus újrapróbálást: az üzemeltető a titkos útvonalat
  védett szerveres eszközzel újrahívhatja; titkot ne illesszen böngészőcímsorba vagy naplóba.
- [ ] Resend feladó domain hozzáadása, a szolgáltató által kért DNS rekordok beállítása és Verified állapot.
- [ ] SPF/DKIM ellenőrzés, DMARC szabály és monitoring az üzemeltető domainjén.
- [ ] `EMAIL_FROM` erről a hitelesített domainről küldjön; valós regisztrációs és visszaállító levél próba.
  Token csak az e-mail link fragmentjében, soha jelentésben vagy screenshoton.

Szolgáltatói referencia: [Neon mentés és helyreállítás](https://neon.com/blog/point-in-time-recovery),
[Vercel aktiválás](https://vercel.com/docs/cli/promote),
[OpenRouter keret és 402 hibák](https://openrouter.ai/docs/api_reference/limits),
[Gemini API adatkezelési és EGT-feltételek](https://ai.google.dev/gemini-api/terms),
[Gemini API számlázás és fizetési szint](https://ai.google.dev/gemini-api/docs/billing),
[Google Cloud költségkeretek és riasztások](https://cloud.google.com/billing/docs/how-to/budgets),
[Resend domainhitelesítés](https://resend.com/docs/dashboard/domains/introduction).

Előnézeti teszthozzáférés: [Vercel automatizált hozzáférés](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation),
[Playwright közös süti-kezelés](https://playwright.dev/docs/api/class-apirequestcontext).

## 7. Opcionális Preview build-migráció és QA-képek

Az ajánlott út minden környezetben a külön `db:migrate`. Opcionális automatikus
Preview migrációhoz **mindegyik** feltétel szükséges:

- `VERCEL_ENV=preview`, `MIGRATE_ON_BUILD=preview-isolated`.
- Ellenőrzött Neon próba-endpoint/adatbázis ujjlenyomata: `PREVIEW_DATABASE_TARGET_SHA256`.
- Production endpoint/adatbázis külön ujjlenyomata: `PRODUCTION_DATABASE_TARGET_SHA256`.
- A két pin eltér, és a runtime, direct és unpooled kapcsolatok mind a próba-pinnel egyeznek.

A pin a pooler-utótag nélküli Neon hostname + URL pathname SHA256 összege;
jelszó és felhasználónév nincs benne. Segédfüggvény: `scripts/build-migration-policy.mjs`.
Ismeretlen szolgáltató, hiányzó pin, eltérő cél vagy production jelző esetén a build leáll,
mielőtt adatbázisművelet indulna. A pineket ellenőrzött ágak alapján az üzemeltető/CI készíti,
nem ugyanabból az ellenőrizetlen connection stringből találja ki. Adatimport buildben soha nincs.

QA-képek kijelölt listája: `docs/qa/SCREENSHOTS.md`, teljes fájllista és ellenőrzőösszeg:
`docs/qa/screenshot-manifest.json`. A többi kép ignorált és helyben megőrzött;
`node scripts/qa-screen-archive.mjs` változtatás/törlés nélkül archiválja az `outputs/qa/screens` alá.

Riasztás referencia: [Vercel Cron védelem](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[OpenRouter account credits](https://openrouter.ai/docs/api/api-reference/credits/get-remaining-credits),
[OpenRouter kulcskeret](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key),
[Resend ismétlésvédelem](https://resend.com/docs/dashboard/emails/idempotency-keys).

## 8. Opcionális hétfői emlékeztető

- Alapból kikapcsolt: `WEEKLY_REMINDERS_ENABLED=false`. Éles bekapcsolás előtt hitelesített
  Resend feladó és kézbesítési próba szükséges; a meglévő `RESEND_API_KEY`, `EMAIL_FROM`,
  `SESSION_SECRET`, `PUBLIC_APP_URL` és `CRON_SECRET` beállításait használja.
- A felhasználó külön kéri a Vállalkozásom oldalon. Csak megerősített e-mail-címmel,
  aktív fiókkal és saját vállalkozással küldhető. Egy levél hetente, egy gomb a heti tervhez.
- A meglévő napi 06:00 UTC Cron futtatja; csak helyi hétfőn küld.
  `WEEKLY_REMINDER_TIMEZONE=Europe/Bucharest`: télen 08:00, nyáron 09:00.
  Nem egyéni időzóna és nem percre pontos kézbesítési ígéret.
- Nincs új SQL migráció: a felhasználó meglévő, privát `auth_metadata` JSON mezője tárolja
  a választást, a feliratkozás azonosítóját és az utolsó kiküldött hetet. A nyilvános user
  adatok és az adatexport nem tartalmaznak belső aláírást vagy küldési zárolást.
- Leiratkozás: aláírt e-mail link, külön megerősítő gomb, belépés nélkül; a token csak
  fragmentben van és a lap eltávolítja a címsorból. GET vagy levélellenőrző robot nem iratkoztat le.
  A Vállalkozásom oldalon is kikapcsolható. A már elindított levél nem vonható vissza.
- Atomi 5 perces zárolás és heti Resend ismétlésvédelem. Küldési hiba vagy a 60 másodperces
  feldolgozási keret után fennmaradó címzettek esetén 503, nem hamis siker.
  Vercel nem próbálja újra automatikusan: az üzemeltető aznap, szükség esetén 5 perc után
  a védett Cron útvonalat újrahívja. Nagyobb címzettkörnél külön tartós sor szükséges.
  A napló csak összesített darabszámot, kategóriát és időpontot tartalmaz.
- Helyi böngészős próba (izolált tároló, szimulált AI és levélküldő):

```sh
npm run test:e2e -- tests/e2e/simple-marketing.spec.ts
```

A nyilvános nyitóoldal ellenőrzése `BASE_URL`-lel is fut. A helyi JSON-t olvasó teljes
feliratkozási/képfeltöltési próba távoli címen szándékosan kimarad; éles kézbesítést ez nem bizonyít.
