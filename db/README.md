# MarketingPilot PostgreSQL storage

The application keeps the existing `readData`/`transact` abstraction. When
`DATABASE_URL` or `DIRECT_URL` is present, `src/lib/server/store.server.ts`
uses PostgreSQL; otherwise it continues to use the existing JSON file. This
allows a safe local fallback while a production database is being provisioned.

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

The default Lovable/TanStack build targets a Cloudflare module. The `pg`
driver needs a Node runtime with TCP access, so deploy the database-backed
variant with `npm run build:node` (or set `NITRO_PRESET=node-server` when
building). A Cloudflare Worker cannot open a native PostgreSQL TCP connection;
for that target a fetch-based Postgres adapter is a later infrastructure
choice.

The adapter takes a transaction-scoped PostgreSQL advisory lock before reading
and replacing the domain snapshot. This prevents two application processes
from overwriting each other while the current business functions still use the
`AppData` abstraction. Later, high-volume paths can be moved to narrow
repository queries without changing route contracts.

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
