# MarketingPilot PostgreSQL storage

The application keeps the existing `readData`/`transact` abstraction. When
`DATABASE_URL` or `DIRECT_URL` is present, `src/lib/server/store.server.ts`
uses PostgreSQL. Without a connection it fails closed; JSON is permitted only
with explicit MARKETINGPILOT_JSON_FIXTURE=true in an isolated development fixture.
Production always rejects JSON, even when that flag is set.

## Setup

1. Put a standard PostgreSQL connection string in `DATABASE_URL`. Use
   `DIRECT_URL` for a direct connection when the provider exposes a separate
   migration endpoint (Supabase commonly does). Do not commit `.env`.
2. Run `npm run db:migrate`. This only creates the schema and the migration
   ledger; it contains no destructive `DROP` or `TRUNCATE` statements.
3. Make a backup copy of the JSON file, then run
   `npm run db:migrate:json`. The script imports the current snapshot inside a
   single transaction and never edits or deletes the JSON source.
4. Restart the application. With `DATABASE_URL` set, all existing server
   functions transparently use PostgreSQL.

The `pg` driver needs a Node runtime with TCP access. Use `npm run build:vercel`
for the configured Vercel/Neon deployment, or `npm run build:node` for a Node
server. The generic `npm run build` targets Cloudflare; that output cannot use
this native PostgreSQL adapter without a different runtime integration.

The adapter takes a transaction-scoped PostgreSQL advisory lock before reading
and replacing the domain snapshot. This prevents two application processes
from overwriting each other while the current business functions still use the
`AppData` abstraction. Later, high-volume paths can be moved to narrow
repository queries without changing route contracts.

Users, workspaces, memberships and brands are upserted without deleting surviving
parent rows. Actual removals still cascade. This preserves independent `ai_calls`
records and daily limits during ordinary business saves; the audit table is never
part of the domain snapshot replacement/import.

## Tables

The initial migration creates users, sessions, workspaces, memberships, brands,
brand profiles, posts, post variants, post versions, campaigns, plan items,
media assets, analytics snapshots, AI jobs, channel connections, OAuth states,
OAuth selections and publish attempts. Foreign keys enforce workspace/brand
ownership relationships and cascade rules remove dependent records safely.
JSONB is used only for the existing flexible fields (AI input/strategy,
platform arrays and nested variants), so the provider remains standard
PostgreSQL and is not tied to Supabase.

The current TanStack session is an encrypted `httpOnly` cookie. The `sessions`
table is provisioned for a future server-side session adapter and is not
populated by the JSON importer; no authentication behavior changes in this
phase.

## Local checks

Without a configured PostgreSQL URL, the commands fail clearly and leave the
JSON store untouched. No fake database or sample records are created.

## Tényalapú tartalom mezői (004)

A `004_content_quality.sql` migráció meglévő rekordok törlése nélkül hozzáadja:

- `brand_profiles.address`, `opening_hours` (opcionális cím és nyitvatartás);
- `post_variants.verification_warnings` (JSON szöveglista);
- `plan_items.draft_content`, `visual_idea`, `topic_summary`, `verification_warnings`.

A régi rekordok üres szöveg/lista alapértékkel kompatibilisek. A workspace/brand kapcsolatok és foreign key szabályok változatlanok; a JSON import és PostgreSQL store az opcionális mezőket is átviszi.

## AI hívásmetaadatok (005)

Az `005_ai_calls.sql` új, szerveroldali táblát ad hozzá (PostgreSQL 15+). Foreign key védi a user,
workspace, membership és brand kapcsolatot. Márka/munkatér/tagság törlésekor az
érintett audit-hivatkozás NULL lesz, a napi user-korlát nem nullázódik. Fióktörlés
az auditrekordot is törli. A táblát
nem tesszük elérhetővé kliens API-n. A napi limit foglalása tranzakcióban,
felhasználónkénti advisory lockkal történik, párhuzamos szerverpéldányok között is.
A limit UTC éjfélkor újul; hiba és JSON-javító kérés is fogyasztja.

Mentett mezők: végpont/modell, bemeneti/kimeneti tokenek és költség (csak tényleges
szolgáltatói usage esetén), késleltetés, státusz, HTTP státusz, biztonságos hibakód,
létrehozás/befejezés időpont. Ismeretlen usage `NULL`, nem becsült költség. Nincs
prompt, generált tartalom, API-kulcs vagy számlázási levonás. Productionben a
migrációt az új kód indítása előtt kell lefuttatni; nincs audit nélküli fallback.
Hosszú távú üzemeltetésnél külön adatmegőrzési/archiválási szabály szükséges.


## Zárt béta auth (006)

Az `006_beta_auth.sql` additív változás: users.auth_metadata (tokenhash és session verzió), post_variants.manual_published_at, valamint tartós auth_rate_limits. A korábbi user auth metaadat nélkül kompatibilis marad. A rate limit kulcs HMAC, nem e-mail/IP. A jelszólenyomat és tokenhash soha nem része a publikus user DTO-nak. Sorrend és mentés/Neon ág: [CLOSED-BETA.md](../docs/CLOSED-BETA.md). A JSON import migráció helyett nem használható.

## Felület módja (007)

Az `007_ui_mode.sql` két additív users mezőt hoz létre: `ui_mode` (NOT NULL,
DEFAULT 'simple', CHECK simple/detailed) és `ui_mode_suggestion_dismissed`
(NOT NULL, DEFAULT false). A korábbi tartalmakhoz nem nyúl. A JSON adapterben a
hiányzó mezők ugyanezeket az alapértékeket jelentik; új regisztráció explicit
simple értéket ment. A PostgreSQL adapter mindkét értéket beolvassa és megőrzi.
A `GET/PUT /api/ui-preferences` az aktuális session felhasználóját használja,
nem fogad el userId/workspaceId mezőt; PUT ugyanazon originhez kötött.

Új kód indítása előtt `npm run db:migrate` szükséges (001–007 sorrendben).
Ez nem aktivál PostgreSQL-t és nem importál JSON-t. A mód eszközök között a
szerveroldali fiókadatból áll helyre, nem böngészőtárból.

## Fő csatorna (008)

Az `008_main_channel.sql` additív `brand_profiles.main_channel` mezőt hoz létre:
NOT NULL, DEFAULT 'facebook', CHECK facebook/instagram. A régi JSON profiloknál
a hiányzó érték Facebook. A PostgreSQL adapter olvassa és menti a választást.
A meglévő márkahang mentése csak akkor módosítja, ha a mezőt megadták.
A csatornaváltás egy tranzakcióban menti a változatot, a verziót és a preferenciát.
Új alkalmazás indítása előtt a 001–008 migrációs sor szükséges.
Mentés, próbaág, előnézet és visszaállítás: [RELEASE.md](../docs/RELEASE.md).

## Napi üzemeltetési ellenőrzés (009)

Az `009_operations_monitor.sql` privát `operations_monitor_runs` táblát és
az AI-hibák idő szerinti aggregálásához indexet ad hozzá. Napi zárolás,
változatlan kategória/darabszám/időpont jelentés és befejezés; nincs prompt,
választörzs vagy kulcs. Nem része a kliens API-nak vagy az ügyfél adatexportjának.
Új alkalmazás előtt külön `npm run db:migrate` (001–009) szükséges.
Production build nem migrál és nem importál; Preview opt-in kizárólag ellenőrzött külön célba.

## Márkához mentett ötletbank (012)

A `012_idea_bank.sql` hozzáad egy nullable `brand_profiles.idea_bank` JSONB mezőt.
Az ötletek az adott márka üzlettípusához és célközönségéhez kötődnek; frissítésük
kifejezett felhasználói művelet, az oldal megnyitása nem indít AI-hívást.
Az adat a márkaprofillal együtt, meglévő workspace- és brand-ownership ellenőrzéssel
íródik. A migráció additív, korábbi adatot nem töröl.
