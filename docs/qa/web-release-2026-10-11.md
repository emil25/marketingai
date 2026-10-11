# Online nyitóoldal kiadása – 2026. október 11.

Alapverzió: `7631b2c`, a meglévő `marketingpilot-v2` production ág.
Cél: a meglévő `marketingai` Vercel projekt és `marketingai-self.vercel.app` domain.

## Hatókör

- Új nyitóoldal, olvasható bemutatóposzt, termékelőnézetek és megosztási kép.
- Az Egyszerű/Részletes belső felület képei kifejezetten a következő, előkészített kiadásként szerepelnek.
- A nyilvános szöveg nem ígér már elérhető önkiszolgáló fióktörlést vagy levélküldést.
- A build nem futtat adatbázis-migrációt vagy adatimportot.
- Auth, alkalmazásoldalak, PostgreSQL adapter és a meglévő adatok változatlanok ebben a kiadásban.

## A teljes belső kiadás előtt

Az eredeti fejlesztői példány új funkciói nem vesztek el. A teljes kiadás külön feladat:
adatbázis-mentés, 005–009 migráció elkülönített ágon, majd production célon;
levélküldő és hitelesített feladó, botvédelem és üzemeltetői adatok beállítása;
új regisztráció és meglévő fiók ellenőrzése az elkülönített telepítésen.
Helyi fiókokat és JSON-adatokat nem importálunk automatikusan.

## Visszaállítás

A korábbi Vercel production telepítés visszaaktiválható. Ez a kiadás nem módosít sémát,
adatbázis-rekordot vagy médiát, ezért nincs adatbázis-visszaállítási lépése.

## Kiadás előtti ellenőrzés

- Teljes Vite build és TypeScript ellenőrzés: PASS.
- Az alapverzió meglévő 77 egységtesztje: PASS (közvetlen Node/tsx futtatás;
  ebben az alapverzióban még nincs `npm test` parancs).
- Chromium és WebKit, 390 és 1280 px: PASS. Előnézetek betöltése/váltása,
  GYIK, túlcsordulás, kész poszt, regisztrációra navigálás és űrlap megjelenése.
- A böngészős teszt nem regisztrált éles felhasználót, és nem hívott valódi AI-t.
- Helyi képernyőképek a fejlesztői példány ignorált
  `outputs/web-release-screens` mappájában; tesztkód `outputs/web-release-smoke.mjs`.
