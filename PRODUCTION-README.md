# MarketingPilot – production előkészítés

Ez a dokumentum a jelenlegi Phase 1–3A alkalmazás üzemeltetési és élesítési alapjait foglalja össze. A UI, az üzleti logika és a szerverfüggvények ugyanazt az absztrakciót használják fejlesztésben és PostgreSQL módban.

## Architektúra

- **Frontend/SSR:** React + TanStack Start + TanStack Router + TypeScript.
- **Szerver:** TanStack Start server functions és API route-ok; a Node production build belépési pontja az `.output/server/index.mjs`.
- **Üzleti adat-elérés:** `src/lib/server/store.server.ts`. Ez a stabil store API; a route-ok nem közvetlenül SQL-lel dolgoznak.
- **Fejlesztői storage:** `data/marketingpilot.json` és a `data/media/` könyvtár. A JSON store tranzakciós írást használ, PostgreSQL nélkül működik.
- **Production storage:** `src/lib/server/postgres-store.server.ts`, szabványos `pg` klienssel. Ha a `DATABASE_URL` vagy `DIRECT_URL` nem üres, a store automatikusan PostgreSQL módra vált.
- **Biztonsági rétegek:** httpOnly session cookie, szerveroldali workspace/brand ownership ellenőrzések, CSRF-védelem a session keretrendszerén keresztül, titkosított Meta tokenek.

## Environment változók

A `.env.example` a teljes névlistát tartalmazza. A valódi `.env` fájl és minden titok maradjon a futtatási környezet titkos tárolójában; ne kerüljön Gitbe, böngészőbe vagy kliensbundle-be.

| Változó | Production szerepe |
| --- | --- |
| `SESSION_SECRET` | Kötelező, legalább 32 karakter; session cookie titkosítása. |
| `CHANNEL_TOKEN_ENCRYPTION_KEY` | Kötelező, legalább 32 karakter; Meta tokenek AES-256-GCM titkosítása. |
| `DATABASE_URL` | PostgreSQL runtime kapcsolat. Beállítása aktiválja a PostgreSQL store-t. |
| `DIRECT_URL` | Opcionális közvetlen PostgreSQL kapcsolat migrációhoz; a migráció ezt részesíti előnyben. |
| `DATABASE_SSL` / `DATABASE_POOL_MAX` | PostgreSQL TLS és pool beállítás. |
| `MARKETINGPILOT_DATA_DIR` | Csak JSON fallback adatkönyvtár. |
| `OPENROUTER_API_KEY` | Szerveroldali szöveges és képes AI-hívások. |
| `OPENROUTER_TEXT_MODEL` / `OPENROUTER_IMAGE_MODEL` | Opcionális modellfelülírás. |
| `META_APP_ID` / `META_APP_SECRET` | Meta OAuth szerveroldali azonosítók. |
| `META_REDIRECT_URI` / `META_GRAPH_VERSION` / `META_OAUTH_SCOPES` | Meta OAuth és Graph API konfiguráció. Productionben a callback HTTPS legyen. |
| `PUBLIC_APP_URL` vagy `MEDIA_PUBLIC_BASE_URL` | Nyilvános HTTPS origin; Instagram képpublikálásnál kötelező. |

`NODE_ENV=production` esetén a session- és tokenkulcs hiánya vagy túl rövid értéke szándékosan hibát okoz. A Node szerver indításakor a host környezetének kell az env-változókat betöltenie; a build önmagában nem másolja be a `.env` tartalmát.

## PostgreSQL migration és JSON import

1. Hozz létre egy üres, elérhető PostgreSQL adatbázist, és a runtime secret store-ban állítsd be a `DATABASE_URL` értéket. Ha a szolgáltató külön migrációs végpontot ad, add meg `DIRECT_URL` néven.
2. Futtasd a séma migrációkat:

   ```sh
   npm run db:migrate
   ```

3. Az aktuális JSON snapshot egyszeri, céladatbázisba történő importja:

   ```sh
   npm run db:migrate:json
   ```

Az import csak üres céladatbázist fogad el, és meglévő PostgreSQL rekordok esetén leáll. A migration runner nem destruktív, a JSON fájlt nem törli és nem írja át. Import előtt készíts szolgáltatói backupot. A cookie-alapú sessionök nem a JSON snapshot részei; új bejelentkezés után jönnek létre.

## Build és indítás

```sh
npm ci
npm run build          # alapértelmezett Nitro/Cloudflare build
npm run build:node     # Node SSR production build
npx tsc --noEmit
node .output/server/index.mjs
```

Productionben a Node folyamatot process managerrel (például systemd, Docker vagy platform-managed service) kell futtatni, és HTTPS reverse proxy mögé tenni. A `PORT` és `HOST` a szolgáltatói környezetből adható meg.

## Adattárolási korlátok

- A JSON store egyetlen gép lokális fájlja; több példány, automatikus backup és többfelhasználós skálázás mellett nem megfelelő.
- A PostgreSQL store éles üzleti adatokhoz való, de a jelenlegi médiafájl-kezelő továbbra is lokális `data/media/` fájlokat ír. Több példányos productionhöz R2/S3-kompatibilis object storage és CDN-integráció szükséges.
- A valódi háttérben futó ütemezett publikáláshoz tartós worker/queue/cron infrastruktúra szükséges; a jelenlegi szerver a publikálási kísérleteket naplózza.

## Külső függőségek

### Meta OAuth és publikálás

Központi Meta alkalmazás, egyező App ID/App Secret, regisztrált production HTTPS callback, megfelelő Graph API scope-ok és App Review/Live mód szükséges. A tokenek csak szerveroldalon, titkosítva tárolhatók. App Review vagy Meta-fiók oldali jogosultság nélkül a Facebook/Instagram kapcsolat és publikálás blokkolt marad.

### OpenRouter

Az AI szöveges funkciók az `OPENROUTER_API_KEY`-t használják. Az AI képgenerálás szolgáltatói kredit- és modellfüggő; HTTP 402 esetén a felhasználó őszinte hibát kap, nincs fake siker.

## Saját képekből készült rövid videó

A posztszerkesztő **Tartalom** lépésében 1–6, az adott márkához tartozó JPG/PNG/WebP képből feliratos MP4 készíthető. Az OpenRouter szöveges modellje a szerkesztett posztszöveg, Brand Voice, vállalkozástípus és kampány alapján ír feliratokat. A felirat, képsorrend és jelenetenkénti 3–8 másodperc szerkeszthető; kézi feliratokkal AI-hívás nélkül is működik. A videó hang nélküli, 720×1280 vagy 720×720 méretű, nem generált mozgókép és nem automatikus publikálás.

A szerver a meglévő `aiJobs` naplózását és `mediaAssets` tárát használja. A sikeres MP4 mentése és a poszthoz rendelés egy store tranzakcióban történik. Az utolsó sikeres videóterv az AI jobban marad meg; a szerkesztett feliratok az MP4-készítéskor mentődnek. Sikertelen összeállításból nem keletkezik médiabejegyzés. A nyers képfájlok ellenőrzése, egyszerre 1 render/Node folyamat, 2 perces render-időkorlát és 20 MB kimeneti korlát védi a feldolgozást.

**Futtatás:** a helyi Node fejlesztői szerver automatikusan használja az `ffmpeg-static` npm csomagot és a Windows Arial betűkészletet. Linux productionben Node szerver, FFmpeg, Arial/DejaVu/Liberation TTF és tartós médiaszolgáltatás szükséges. Az `FFMPEG_PATH` és `VIDEO_FONT_PATH` opcionális szerveroldali felülírás; a telepített FFmpeg csomagot/binaryt a deploymentnek meg kell őriznie. Cloudflare Workers nem futtatja a natív FFmpeg folyamatot; ott ez a funkció nem elérhető. A renderer jelenleg a kérés ideje alatt fut, nincs tartós háttérworker vagy újraindítás utáni automatikus folytatás. Az éles szerver/proxy kérési időkorlátja legalább 150 másodperc legyen.

**Ellenőrzés:** `node --import tsx --test tests/video.test.ts` külön, ideiglenes QA store-ban fut, élő adatot nem módosít. Vizsgálja az izolációt, érvénytelen bemenetet, tényleges MP4-kódolást/dekódolást, magyar feliratokat és a hibás render utáni újrapróbálást.

## Ideiglenes helyi adminbelépés

A `/login` oldalon a **Belépés adminnak** gomb csak `NODE_ENV=development`, `ENABLE_LOCAL_ADMIN_LOGIN=true`, valamint egy meglévő owner/admin `LOCAL_ADMIN_USER_ID` és `LOCAL_ADMIN_WORKSPACE_ID` beállítása esetén érhető el. A szerver csak localhost/loopback, azonos originű kérést fogad el; proxy/forwarded kérések tiltottak. Productionben a funkció akkor sem működik, ha a kapcsoló véletlenül bekapcsolva marad. Alapértelmezetten kikapcsolt.

A belépés a normál titkosított session cookie-t állítja be, nem változtat jelszót, szerepkört vagy üzleti adatot. Ez kizárólag az adott gépen dolgozó fejlesztő számára való; megosztott vagy nyilvános környezetben maradjon kikapcsolva. Tesztek: `node --import tsx --test tests/local-admin.test.ts`.

## Production előtti ellenőrzőlista

- [ ] PostgreSQL projekt és backup/restore folyamat kész.
- [ ] `DATABASE_URL`, `SESSION_SECRET`, `CHANNEL_TOKEN_ENCRYPTION_KEY` titkosan beállítva.
- [ ] `npm run db:migrate`, majd egyszer `npm run db:migrate:json` sikeresen lefutott.
- [ ] HTTPS origin, Meta callback és CORS/proxy beállítás ellenőrizve.
- [ ] Object storage és worker/cron megoldás kiválasztva, ha több példány vagy időzített publikálás kell.
- [ ] OpenRouter és Meta kvóta/jogosultság ellenőrizve.
- [ ] Build és TypeScript ellenőrzés zöld.

Jelenlegi állapot: PostgreSQL kapcsolat nélkül a fejlesztői JSON fallback működik; éles többfelhasználós SaaS-hoz előbb PostgreSQL, titkos env-kezelés, HTTPS és tartós média storage szükséges.
