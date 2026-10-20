# Production utáni gyorspróba

Csak sikeres külön migráció és éles, tesztkapcsolók nélküli telepítés után.
Kijelölt, valódi tesztfiókkal; jelszó/token ne kerüljön jelentésbe vagy képernyőképre.

- [ ] HTTPS, nyitóoldal és `/api/health` rendben; nincs böngészős vagy szerverhiba.
- [ ] Valódi regisztráció: ellenőrző és üdvözlő levél megérkezik a hitelesített feladótól.
- [ ] Első poszt valódi OpenRouter modellel elkészül, mentés és újratöltés működik.
- [ ] Egyszerű/Részletes mód és Facebook/Instagram fő csatorna új belépéskor is megmarad.
- [ ] Képfeltöltés, saját kép megjelenítése; másik fiók nem fér hozzá.
- [ ] Kijelentkezés után a védett oldal belépést kér; jelszó-visszaállító levél és új jelszó működik.
- [ ] Adatvédelem, feltételek és kapcsolat valós üzemeltetői adatokkal elérhető.
- [ ] Napi Cron sikeres futás; kijelölt tesztriasztás valóban megérkezett az üzemeltetőhöz.
- [ ] Heti emlékeztető bekapcsolása esetén: saját tesztfiók külön feliratkozik,
  hétfőn egy valódi levél megérkezik, a heti terv gombja és a megerősített leiratkozás működik.
  Kikapcsolt vagy nem megerősített fiók nem kap levelet; ismételt futás nem küld kétszer.
- [ ] Naptárban a saját poszt szövege és feltöltött képe látszik; dátumváltás újratöltés után is megmarad.

Jegyezd fel: telepítés azonosítója, időpont, PASS/FAIL, titokmentes hibatípus.
Hibánál a `RELEASE.md` visszaállítási rendjét kövesd; adatbázist ne tekerj vissza automatikusan.
