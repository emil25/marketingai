# Onboarding és csatornaszöveg finomítás – 2026-10-08

## Javítások

- A Facebook és Instagram külön nyitósort, felépítést és lezárást kér. A túl hasonló kimenet egyszer javításra visszakerül az AI-hoz.
- Instagramnál 4–6 különböző, nem üres hashtag szükséges. A másolás és publikálás a külön mentett hashtagmezőt hozzáfűzi a szöveghez.
- A CTA-mező a szöveg zárómondatát ismétli; nem eredményezhet külön második felhívást. A Facebook lezáró kérdése és a magázó felhívások is elfogadhatók.
- További ellenőrzés a te/ti keverésére, a „reggelije … vár” mondatra és az üres „napod igazán jól kezdődjön” fordulatra. Ezek korlátozott, szövegmintákon alapuló ellenőrzések, nem teljes nyelvi vagy tényellenőrzés.
- Onboarding: kötelező cégnév és gombsúgó; belépési sáv csak az első lépésben; opcionális cím/nyitvatartás súgó; napi nyitva/zárva/nincs megadva állapot; https nélküli webcím; logófájl; konkrét termékek, ajánlat, célközönség, rendelési mód és megszólítás.
- A napi időpontok az eddigi `openingHours` profilmezőbe kerülnek egyértelmű szöveggel. A rendelési mód az eddigi `ctaStyle`, a megszólítás az `aiGuardrails` része; nincs új párhuzamos adatmodell.
- Logó: meglévő autentikált médiafeltöltés, valódi márkaprofil-hivatkozás, MIME/méret/signature ellenőrzés, privát média. A Márka oldalon is cserélhető, URL másodlagos.
- Helykitöltős posztnál elérhető a Márkaprofil pótlási link. A meglévő posztot ettől még szerkeszteni kell, nincs hamis automatikus javítás.

## Tényleges ellenőrzés

- Böngésző: 6 onboarding lépés, kötelező cégnév, hibás webcím, hiányos időpont helyben maradó hibája, natív időbevitel és továbblépés, normalizált webcím visszalépéskor, ajánlat/termék/rendelés/közönség, te/Ön választás.
- Mobil: 390 px szélességen nincs vízszintes túlfutás a termék/ajánlat lépésben. Képernyőkép: az elkülönített QA kimenetek között.
- Böngésző: álcázott PNG elutasítása; valódi teszt-PNG mentése; újratöltés után a mentett logó betöltődik.
- Valódi helyi HTTP integráció: signup → workspace/brand → profil → logout/login; új mezők megmaradnak és bekerülnek a közös AI kontextusba. Idegen márkához feltöltés 403, idegen médiakép olvasása elutasítva, anonim feltöltés 401.
- Kizárólag egyértelműen TESZT jelölt, elkülönített helyi fiókok; éles JSON SHA256 változatlan: `6D82989068C2886FC8C68B57FD14E4AD5C44EE393A3ADEC8975DEE4488AD8FBD`.
- Összes automatizált teszt: 72/72 PASS. TypeScript PASS. Production build PASS.
- Célzott lint: 0 hiba; a már meglévő márkaoldali effect dependency figyelmeztetés megmarad. Nincs teljes repository-formázás.

## Élő AI: részleges, végül külső akadály

Az első valódi OpenRouter-hívások a megszólítás és CTA további hibáját bizonyították. A javított ellenőrzések után az új kérés 402 kreditkorlátba ütközött. Nem készült elfogadott új poszt vagy teljes új 30 napos terv. A végső eredmény: `muhely-pekseg-refinement.json` (blocked).

A régebbi mintákból kimaradt hashtageket a ténylegesen mentett tesztváltozatokból pótoltuk a jelentésben. A történeti minták egyértelműen jelölve vannak; nem állítjuk, hogy az új prompt kimenetei.
