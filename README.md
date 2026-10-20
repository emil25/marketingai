# MarketingPilot V2

Kisvállalkozások marketing-munkatere: saját márkahang, AI-posztok és platformváltozatok, kampányok, 30 napos terv, Planner, naptár, Médiatár, képposztok és carousel.

## Melyik változat ez?

Ez a jelenlegi, TanStack Start alapú MarketingPilot. A repository `main` ágában lévő korábbi AI Business OS prototípus külön változat; nem azonos ezzel az alkalmazással. A `marketingpilot-v2` ág őrzi a jelenlegi MarketingPilot forrását, az eredeti Git-előzmények megtartásával.

**A GitHub-link forráskódot nyit meg, nem futó alkalmazást.** Az online MarketingPilot címe: [marketingai-self.vercel.app](https://marketingai-self.vercel.app). A Vercel projekt a `marketingpilot-v2` ágból épül; a még nem publikált helyi változások nem jelennek meg automatikusan az online oldalon.

## Fejlesztés

A zárt béta indítási és visszaállítási listája: [docs/CLOSED-BETA.md](docs/CLOSED-BETA.md).
Fejlesztéshez elkülönített Neon ágat használj. Adatbázis-hozzáférés nélkül a JSON
store megtartott kompatibilitási mód; az automatikus teszt kizárólag az
`outputs/beta-e2e-data` fixture-t használja, nem az ügyfelek adatait.

```sh
npm ci
npm run dev
```

A `.env.example` a beállítások neveit tartalmazza. Titkot, helyi üzleti adatot, feltöltött médiát és privát QA másolatot nem tárolunk a repositoryban.

## Ellenőrzés és Node build

```sh
npm run build
npm run build:node
npx tsc --noEmit
npm test
npm run test:e2e
node .output/server/index.mjs
```

Az alkalmazás React, TypeScript, TanStack Start/Router, Vite, Tailwind és szerveroldali OpenRouter rendszerre épül. A Vercel szerverfüggvények Neon PostgreSQL-t és privát Vercel Blob képtárat használnak. Az API-k és a workspace/brand jogosultságok a szerveren működnek. A JSON store kizárólag explicit MARKETINGPILOT_JSON_FIXTURE=true fejlesztői tesztként engedélyezett; productionben tiltott; PostgreSQL kapcsolat esetén a szabványos PostgreSQL adapter működik.

## AI-tartalom minősége és megbízhatósága

A közös üzleti kontextus tartalmazza a vállalkozástípust, termékeket/szolgáltatásokat, ajánlatot, elérhetőséget, nyelvet, régiót és márkahangot. A posztok és heti tervek közös tényalapú szabályokat használnak; a hiányzó konkrét adatok helykitöltők. Ezek szerveroldalon blokkolják a kész állapotot, ütemezést és publikálást.

A 30 napos terv hetente készül, az előző témák továbbadásával. Minden ellenőrzött hét külön mentődik az AI jobban; a Planner/Calendar csak a teljes, sikeres tervet kapja meg. A kampány részletezőjében egy hét külön újrakérhető. Kapcsolt vagy ütemezett posztot tartalmazó hetet nem írunk felül.

Az `ai_calls` szerveroldali operatív napló az `005_ai_calls.sql` migrációval jön létre. Csak hívásmetaadatot, tényleges szolgáltatói token/költség adatot, időt és státuszt tárol; promptot, választ és kulcsot nem. Az `AI_DAILY_CALL_LIMIT` felhasználónként, UTC nap szerint korlátoz (alapérték: 100), a hibás és javító hívások is beleszámítanak. JSON fejlesztésben külön `ai-calls.json` fájlt használ. A hibás JSON egyszer javítható új AI-kéréssel; a 402/429/5xx hiba nem vált ki automatikus ismétlést.

```sh
npm test
```

A valódi Műhely Pékség QA eredménye a [docs/qa](docs/qa) könyvtárban található. Szolgáltatói kredit hiányában nincs generált heti JSON; ezt külön blokkolt állapotként dokumentáljuk.

Zárt béta ellenőrzés: [2026-10-08 QA jelentés](docs/qa/closed-beta-2026-10-08.md).
A külső AI/e-mail válaszok mockolt böngészős tesztje: `npm run test:e2e`.
A Node build után adatbázis nélküli production védelmek: `node tests/production-smoke.mjs`.

## Állandó online működés

Az alkalmazás nem statikus GitHub Pages oldal. Tartós PostgreSQL adatbázis, tartós médiatárolás, szerveroldali titkos beállítások és HTTPS szükséges. A helyi JSON/media könyvtárak nem alkalmasak Vercel serverless tartós adatkezelésre. A helyi adminbelépés productionben tiltott.

Részletek: [PRODUCTION-README.md](PRODUCTION-README.md). Az eredeti és jelenlegi funkciók összevetése: [docs/FEATURE-COMPARISON.md](docs/FEATURE-COMPARISON.md).

## Külső függőségek

- Zárt béta regisztráció: hitelesített Resend feladó, Turnstile és valós
  `OPERATOR_NAME`, `OPERATOR_EMAIL`, `OPERATOR_ADDRESS`, HTTPS `PUBLIC_APP_URL`.
  Ezek nélkül productionben a regisztráció tiltott. A megerősítetlen fiók AI-t
  nem használhat. A jelszó-visszaállítás és e-mail-megerősítés egyszer használható,
  lejáró, csak hashként tárolt tokennel működik.
- A béta közzétételi folyamata: csatornánként másolás, majd **Közzétettem**.
  Ez saját jelölés, nem igazolt platformközzététel. Automatikus posztolást a béta
  nem ígér. Az ütemezés tervezett időpont, nem háttérben futó közzététel.

- Meta kapcsolat és valódi Facebook/Instagram publikálás: megfelelő App Secret, jogosultságok és HTTPS média szükséges; még nincs igazolt éles publikálás.
- OpenRouter képgenerálás: szolgáltatói kredit szükséges. Saját fotós képposzt/carousel ezt nem igényli.
- Valódi automatikus időzített publikálás: tartós háttérfeldolgozó szükséges.
