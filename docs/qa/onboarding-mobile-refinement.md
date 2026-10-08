# Mobil onboarding finomítás – 2026-10-08

## Változások

- A nyitvatartás összecsukva indul. Minden nap / hétköznap–hétvége / naponként nézet, két időmező és Zárva jelölés. A nézetváltás önmagában nem írja felül az adatokat; eltérő napoknál figyelmeztetés jelenik meg. Az üres nap továbbra is ismeretlen, nem zárva.
- Magyar Logó kiválasztása gomb, fájlnév/méret, előnézet; ugyanaz a választó az onboardingban és a Márka oldalon. PNG/JPEG/WebP: legfeljebb 20 MB bemenet, 40 megapixel; helyi kicsinyítés legfeljebb 1600 px oldalra és 2 MB alá. A szerver MIME/signature/méret/auth/ownership ellenőrzése változatlanul kötelező. Az átlátszó PNG háttere megmarad.
- A kép előkészítése nem küld adatot külső szolgáltatásnak. A dekódolás és kódolás időkorlátos; hibánál nincs hamis siker és a továbblépés újra elérhető.
- Rövidebb súgók, opcionális elérhetőség a cégadatok között. A meglévő contactMethod → profil.ctaStyle → közös AI kontextus útvonal változatlan; nincs új adatmodell.
- URL-billentyűzet, organization/street-address/address-level2/url autocomplete. A Tovább érintésre validál, cégnévhibánál a mezőre fókuszál és hozzá kapcsolt hibaüzenetet mutat.
- A csatornalépés őszintén megkülönbözteti a Meta-kapcsolatot a másolható tartalomtól. Nem készül új csatlakoztatási funkció.

## Ellenőrzés

- Böngészőben a teljes hat lépés, előre/hátra navigáció, névhiba, webcím normalizálás, elérhetőség és hangnem. 390 × 844 CSS-pixeles nézetben nincs vízszintes túlfutás.
- Minden nap zárva beállítás mind a hét napra átvitt; külön hétköznapi nyitás/zárás mind az öt munkanapra átvitt; a hétvége külön maradt. Nézetváltás után az időpontok megmaradtak, továbblépéskor a meglévő openingHours mezőbe kerülnek.
- Valódi böngészős fájlválasztás: 7 843 858 bájtos teszt-PNG automatikusan 1370 KB körüli fájlra kicsinyült, előnézet megjelent. Kis PNG megtartva; a lépések közti visszalépéskor a kiválasztott kép és neve megmaradt.
- Valódi helyi HTTP integráció: signup → workspace/brand → profil → logout/login, közös AI kontextus, logómentés; idegen brand 403, idegen média elutasítva, anonim feltöltés 401. Kizárólag elkülönített TESZT adatok.
- 13 célzott automatizált teszt PASS. TypeScript és production build PASS; végleges Vercel-csomag és célzott lint ellenőrizve az élesítés előtt.
- Az eredeti JSON hash változatlan: `6D82989068C2886FC8C68B57FD14E4AD5C44EE393A3ADEC8975DEE4488AD8FBD`.
- Talált és javított hiba: a közvetlenül importált `.client.ts` fájlt a TanStack SSR védelme tiltja. Az előkészítő SSR-biztos modulba került; böngészős művelete csak fájlválasztás után fut.

## Képek és korlátok

Az `outputs/landing-qa/onboarding-compact-*.jpg` képek külön a cégadatokat, a nyitvatartást, vállalkozástípust, csatornákat, termékeket/ajánlatot, hangnemet és a fióklépést mutatják. Egyértelmű TESZT adatok, jelszó nélkül.

Natív iPhone/Android galériát és képernyőbillentyűzetet ez a desktop böngésző nem bizonyít; az elfogadott képtípusok és beviteli attribútumok be vannak állítva. A 30 napos AI-tervet ebben a körben nem futtattuk újra: a legutóbbi élő kérést OpenRouter 402 kreditkorlát blokkolta. Az onboarding képei a kért alternatív bizonyítékok.
