# Régi projektek → jelenlegi MarketingPilot V2

Ellenőrzés: 2026-10-05. A jelenlegi MarketingPilot a fő termék. Ez a lista a kód összevetését dokumentálja; nem állítja, hogy minden korábbi vagy külső funkció élőben tesztelve van.

## 1. Az eredeti MarketingPilot ZIP

Forrás: `MarketingPilot AI_ Your Growth Engine.zip`, a 2026-09-15 teljes audit és a jelenlegi route/server források. Az eredeti csomag demo üzleti adatokat tartalmazott, míg a jelenlegi alkalmazás mentett workspace/brand/post/campaign rekordokkal dolgozik.

| Eredeti funkció | Jelenlegi megfelelő / állapot |
|---|---|
| Dashboard | `/app`, valódi aktív márka és mentett poszt/média/terv adatok |
| Vállalkozástípus | Mentett Brand Profile `businessType`, 15 kategória, közös AI kontextus és 6 gyorsindító/kategória |
| Facebook/Instagram/TikTok/Google szöveg | Posztkészítő és platformváltozatok; Brand Voice, saját közönség/nyelv/kampány alapján |
| Blog és hírlevél | A régi tartalomgenerátor `/app/content/blog` és `/app/content/newsletter` továbbra is megvan; nem teljes blog/CMS vagy email-kiküldő integráció |
| Kampányok | Mentett brief, AI stratégia, tartalomcsomag, planItems és posztkapcsolatok |
| 30 napos Planner | Közös planItems, szerkesztés és posztkészítés |
| Naptár | Hónap/hét/nap, dátum/idő mentés a közös planItems adatforrásba |
| Brand Voice | Mentett profil, saját példák és tanult márkahang; nincs rögzített Napfény Étterem kontextus |
| AI képek | OpenRouter és meglévő Médiatár; szolgáltatói kredit szükséges |
| Recommendations | Az oldal megvan, de jelenleg feltételeket/üres állapotot mutat. Automatikus teljesítményalapú ajánlásgenerálás nincs bekötve ezen az oldalon |
| Analytics | Strukturált snapshot modell, 7/30/90 szűrő és valódi adatokból számítás; automatikus social adatlehívás még nincs |
| Subscription | Őszinte üres állapot; nincs valódi fizetés vagy automatikus számlázás |
| Admin | Védett munkatér-adatok; nem demo felhasználólista |

Az eredeti KPI-k, TODAY_TASKS, IDEAS, RECENT_POSTS, RECOMMENDATIONS és buildPlan minták nem kerülnek vissza üzleti adatként. A régi képernyőkkel való teljes vizuális egyezés nem cél; a mostani design marad.

## 2. A GitHub main ágban lévő AI Business OS

Kiinduló commit: `c6798a790ce378a15b0f5d071460ff97de68699d`. Ez egy másik React/Vite prototípus, `src/App.jsx`-ben egyetlen nagy alkalmazással. A jelenlegi Vercel production oldal ezt az ágat futtatja.

| Ötlet | Átvétel / javaslat |
|---|---|
| Piac­tér / iparági AI kártyák | Átvéve a Márka AI „Vállalkozásodra szabva” részébe. Valódi businessType mentés, nem „telepített” álmodul. Fogászat, ingatlaniroda, fitness és autókereskedés is választható |
| Tartalom stúdió | A jelenlegi mentett posztkészítő erősebb alap: szerkesztés, változatok, verziók, előnézet, képposzt/carousel |
| Napi AI összefoglaló / egyértelmű teendők | Érdemes később beépíteni a meglévő Dashboardba, valós tervek és teljesítmény alapján |
| HU/RO/EN kezelőfelület | Érdemes később közös fordítási rendszerként. A tartalom nyelve már márkánként megadható; a teljes UI fordítása külön feladat |
| Weboldal elemző / SEO | Érdemes: valódi oldal-feldolgozás → profiljavaslat → jóváhagyott tartalomterv. Most a weboldal mentett kontextus, nem igazolt automatikus webaudit |
| Google Business értékelés-válaszok | Hasznos következő integráció, de jelenleg csak Google-posztszöveg készül; nincs valós értékelés-letöltés vagy válaszpublikálás |
| Heti riport és marketingdiagnózis | Érdemes valódi analytics snapshotokból. A régi fix üzleti pontszám nem vehető át adatként |
| CRM, support, marketplace, finance, sok külön AI agent | Nem elsődleges egy marketinges nélküli KKV-nak. Későbbi scope, nem szükséges újraírás |
| Régi Anthropic proxy | Nem vesszük át: nincs benne auth/workspace izoláció/használati korlát; a jelenlegi közös szerveroldali OpenRouter marad |
| Régi KPI-k és Café Aurora kontextus | Nem vesszük át: statikus minták, nem a felhasználó valós adatai |
| „Telepítve” piactér gomb | Nem valódi szolgáltatás-telepítés; helyette mentett vállalkozástípus és működő gyorsindítók |

## 3. Következő fejlesztési sorrend

1. **Állandó online működés:** tartós PostgreSQL és médiatár, production titkok, HTTPS, deployment és böngészős ellenőrzés. A forrás GitHubra feltöltése önmagában nem indítja el ezt az alkalmazást.
2. **Kapcsolódás és közzététel:** Meta akadály rendezése, egy valódi Facebook és Instagram publikálás végigtesztelése, majd tartós ütemező.
3. **Eredményből következő teendő:** social metrikák lehívása, heti riport, legfeljebb 3 egyszerű AI-javaslat valódi adatokból.
4. **Kevesebb adatbevitel:** weboldalból ellenőrizhető márkaprofil-javaslat, opcionális iparágválasztás, egy rövid briefből poszt + kép/carousel.

Nem ajánlott újabb designváltás, sok új menüpont vagy statikus üzleti pontszám. A meglévő munkafolyamatot kell online elérhetővé és végig megbízhatóvá tenni.

## 4. Most igazolt ellenőrzések

- Valódi OpenRouter válasz egy képposzthoz és négy külön carousel laphoz.
- Szerkesztett kép/caption, saját fotó feltöltése, JPEG mentés a Médiatárba és a poszthoz, lapozható előnézet, újratöltés utáni megmaradás.
- Valódi JPEG- és ZIP-letöltés; ZIP-ben 4 kép és UTF-8 posztszöveg.
- Vállalkozáskártya keresés, választás, szerveroldali profilmentés, újratöltés és Dashboard gyorsgombok átállása az elkülönített QA store-ban.
- Publikálási carousel protokollt szimulált API-válaszokkal teszteltük; nem történt valódi Meta publikálás.
- Tesztadatok kizárólag elkülönített helyi másolatban. Az eredeti JSON hash változatlan.

A régi kód a `main` ágban és a Git előzményekben megmarad. A `marketingpilot-v2` ág új gyökerében a jelenlegi MarketingPilot fut; a régi szabadon hívható Anthropic API és régi Vite config nincs bekötve ebbe a változatba.
