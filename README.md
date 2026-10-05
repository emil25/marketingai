# MarketingPilot V2

Kisvállalkozások marketing-munkatere: saját márkahang, AI-posztok és platformváltozatok, kampányok, 30 napos terv, Planner, naptár, Médiatár, képposztok és carousel.

## Melyik változat ez?

Ez a jelenlegi, TanStack Start alapú MarketingPilot. A repository `main` ágában lévő korábbi AI Business OS prototípus külön változat; nem azonos ezzel az alkalmazással. A `marketingpilot-v2` ág őrzi a jelenlegi MarketingPilot forrását, az eredeti Git-előzmények megtartásával.

**A GitHub-link forráskódot nyit meg, nem futó alkalmazást.** A korábbi `marketingai-self.vercel.app` oldal a régi `main` ághoz kapcsolódik. Amíg a MarketingPilot deployment nincs beállítva és böngészőben ellenőrizve, ez nem tekinthető MarketingPilot V2 preview-nak.

## Fejlesztés

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
node .output/server/index.mjs
```

Az alkalmazás React, TypeScript, TanStack Start/Router, Tailwind és szerveroldali OpenRouter rendszerre épül. Az API-k és a workspace/brand jogosultságok a szerveren működnek. A JSON fejlesztői store megtartott; PostgreSQL kapcsolat esetén az előkészített PostgreSQL adapter működik.

## Állandó online működés

Az alkalmazás nem statikus GitHub Pages oldal. Tartós PostgreSQL adatbázis, tartós médiatárolás, szerveroldali titkos beállítások és HTTPS szükséges. A helyi JSON/media könyvtárak nem alkalmasak Vercel serverless tartós adatkezelésre. A helyi adminbelépés productionben tiltott.

Részletek: [PRODUCTION-README.md](PRODUCTION-README.md). Az eredeti és jelenlegi funkciók összevetése: [docs/FEATURE-COMPARISON.md](docs/FEATURE-COMPARISON.md).

## Külső függőségek

- Meta kapcsolat és valódi Facebook/Instagram publikálás: megfelelő App Secret, jogosultságok és HTTPS média szükséges; még nincs igazolt éles publikálás.
- OpenRouter képgenerálás: szolgáltatói kredit szükséges. Saját fotós képposzt/carousel ezt nem igényli.
- Valódi automatikus időzített publikálás: tartós háttérfeldolgozó szükséges.
