# Négy lépéses onboarding – 2026-10-08

## Változás

- Típus → Cég és kínálat → Márka → Fiók. A korábbi tájékoztató csatornalépés megszűnt; az onboarding nem ígér és nem hoz létre social kapcsolatot. A valódi kapcsolatok továbbra is a Csatornák oldalon kezelhetők.
- Pékség / kávézó / cukrászda (`bakery_cafe`) és Üzlet / bolt (`retail`), mindkettőhöz hat meglévő posztkészítőbe vezető gyorsindító. Nincs előre kijelölt típus; pipa és aria-pressed jelöli a választást. Az Egyéb leírása az eddigi `brand.industry` mezőbe kerül; típusváltáskor a régi egyéni leírás törlődik.
- Termékek, szolgáltatások, ajánlat és közönség a második lépés látható fő mezői. Cím, elérhetőség és a meglévő strukturált nyitvatartás opcionálisan lenyitható.
- Egy hangnem, külön opcionális hangulat, három megszólítás (te / Ön / ti), saját hex-szín. Könyvelő és ügyvéd esetén alapból Ön, más típusnál te. A kézi választást későbbi típusváltás nem írja felül. Az élő stílusminta a tényleges cégnévre és választásokra reagál; egyértelműen szemléltetés, nem AI-generált üzleti tartalom.
- Beágyazott fióklépés ismételt logó, belső kártya, típus- és munkatérmező nélkül. A cégnévből lesz a munkatér neve. Jelszószem, new-password autocomplete, használati feltételek és adatvédelmi hivatkozások.
- Ideiglenes sessionStorage piszkozat, kizárólag az adott böngészőlap munkamenetére, 24 órás érvényességgel. Engedélyezett mezők listája; jelszó, token, email, felhasználói név és fájl kizárva. Nincs localStorage és nincs új üzleti adatforrás. Sikeres regisztrációkor törlődik. A logófájlt újratöltés után ismét ki kell választani. A céges adatok szerveroldali mentése változatlan.
- Az új megszólítás és hangulat a meglévő profil.aiGuardrails mezőn át a közös AI-kontextusba kerül. A tartalomellenőrzés felismeri a többes számú CTA-kat is. Nincs adatbázis-sémaváltás.

## Tényleges ellenőrzés

- 21 célzott automatizált teszt PASS: típusok/gyorsindítók, közös üzleti kontextus, megszólítások, élő minta, CTA-k, piszkozat-adatvédelem, meglévő URL/nyitvatartás/logó ellenőrzések.
- Valódi HTTP-teszt az elkülönített helyi QA-adattáron: signup → workspace/brand → profil → logout/login. Pékség típus, egyéni leírás, többes megszólítás és hangulat mentése; könyvelőnél explicit megszólítás nélkül magázó alapérték. A közös AI-kontextus megkapta a ténylegesen mentett adatokat. Logómentés és tenant isolation: idegen brand feltöltése 403, idegen média olvasása elutasítva, anonim feltöltés 401.
- Böngésző, 390 × 844 CSS-pixel: négy lépés, kezdetben nincs típus kijelölve, választási hiba és Egyéb-leírás hiba, kipipált kijelölés, termék/ajánlat kitöltés, te/Ön/ti élő minta, külön hangulat/szín, vissza/előre, újratöltés utáni szöveg- és beállítás-visszaállítás. Vízszintes túlfutás nincs; az oldal alapszíne krém (`rgb(246,242,233)`) a hosszú oldalon is.
- Fióklépés: csak név/email/jelszó; jelszószem váltja a típust, new-password attribútum jelen van; jogi linkek elérhetők. Böngészőben új hitelesítő adatot nem adtunk meg; a mentést a fenti elkülönített HTTP-teszt igazolja.
- Képek: `outputs/landing-qa/onboarding-four-products.jpg`, `onboarding-four-brand.jpg`, `onboarding-four-account.jpg`. Egyértelmű TESZT adatok, jelszó nélkül.
- Az eredeti `data/marketingpilot.json` SHA256 változatlan: `6D82989068C2886FC8C68B57FD14E4AD5C44EE393A3ADEC8975DEE4488AD8FBD`.

## Korlát

Ez az ellenőrzés az onboarding mentését és az AI-kontextus összeállítását bizonyítja. Új élő AI-válasz minőségét nem állítja igazoltnak: a legutóbbi OpenRouter-kérés 402 kreditkorlátba ütközött. A Meta OAuth és a PostgreSQL-adapter nem változott. A szín manuálisan állítható; automatikus logópaletta-kinyerés nem készült. Natív mobilbillentyűzetet és galériát a desktop böngésző nem igazol.
