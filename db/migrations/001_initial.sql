-- MarketingPilot PostgreSQL schema
-- Additive migration only: creates tables, constraints and indexes.
-- Existing JSON data is never touched by this migration.

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text NOT NULL,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL,
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (user_id);

CREATE TABLE IF NOT EXISTS brands (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  website text NOT NULL DEFAULT '',
  city_region text NOT NULL DEFAULT '',
  language_market text NOT NULL DEFAULT '',
  industry text NOT NULL DEFAULT '',
  products text NOT NULL DEFAULT '',
  services text NOT NULL DEFAULT '',
  offers text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS brands_workspace_idx ON brands (workspace_id);

CREATE TABLE IF NOT EXISTS brand_profiles (
  id text PRIMARY KEY,
  brand_id text NOT NULL UNIQUE REFERENCES brands(id) ON DELETE CASCADE,
  tone text NOT NULL DEFAULT '',
  cta_style text NOT NULL DEFAULT '',
  "values" text NOT NULL DEFAULT '',
  preferred_phrases text NOT NULL DEFAULT '',
  avoided_phrases text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  approved_examples text NOT NULL DEFAULT '',
  ai_guardrails text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '',
  colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  font_family text NOT NULL DEFAULT '',
  learning_samples jsonb NOT NULL DEFAULT '[]'::jsonb,
  learned_summary text NOT NULL DEFAULT '',
  learned_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text NOT NULL,
  audience text NOT NULL,
  offer text NOT NULL,
  description text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  timezone text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'planning', 'active', 'paused', 'completed', 'archived')),
  budget numeric,
  success_criteria text NOT NULL,
  channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta text NOT NULL,
  strategy jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS campaigns_workspace_brand_idx ON campaigns (workspace_id, brand_id);

CREATE TABLE IF NOT EXISTS posts (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  campaign_id text REFERENCES campaigns(id) ON DELETE SET NULL,
  title text NOT NULL,
  goal text NOT NULL,
  audience text NOT NULL,
  language text NOT NULL,
  tone text NOT NULL,
  status text NOT NULL CHECK (status IN ('idea', 'draft', 'review', 'scheduled', 'published', 'failed')),
  scheduled_at timestamptz,
  timezone text NOT NULL,
  media_asset_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  platforms jsonb NOT NULL DEFAULT '[]'::jsonb,
  hooks jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_hook text,
  ab_variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  ad_copies jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_workspace_brand_idx ON posts (workspace_id, brand_id);
CREATE INDEX IF NOT EXISTS posts_campaign_idx ON posts (campaign_id);

CREATE TABLE IF NOT EXISTS post_variants (
  id text PRIMARY KEY,
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform text NOT NULL,
  content text NOT NULL,
  hashtags jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'review', 'prepared', 'published', 'failed')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS post_variants_post_idx ON post_variants (post_id);

CREATE TABLE IF NOT EXISTS post_versions (
  id text PRIMARY KEY,
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  variant_id text REFERENCES post_variants(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS post_versions_post_idx ON post_versions (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS plan_items (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  campaign_id text REFERENCES campaigns(id) ON DELETE SET NULL,
  post_id text REFERENCES posts(id) ON DELETE SET NULL,
  date date NOT NULL,
  time time,
  timezone text NOT NULL,
  platform text NOT NULL,
  content_type text NOT NULL,
  topic text NOT NULL,
  objective text NOT NULL,
  status text NOT NULL CHECK (status IN ('idea', 'planned', 'draft', 'ready', 'scheduled', 'published', 'skipped')),
  ai_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS plan_items_workspace_brand_date_idx ON plan_items (workspace_id, brand_id, date);
CREATE INDEX IF NOT EXISTS plan_items_campaign_idx ON plan_items (campaign_id);
CREATE INDEX IF NOT EXISTS plan_items_post_idx ON plan_items (post_id);

CREATE TABLE IF NOT EXISTS media_assets (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size bigint NOT NULL CHECK (size >= 0),
  width integer,
  height integer,
  path text NOT NULL,
  alt_text text NOT NULL DEFAULT '',
  source text NOT NULL CHECK (source IN ('upload', 'ai', 'import')),
  created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS media_assets_workspace_brand_idx ON media_assets (workspace_id, brand_id);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform text NOT NULL,
  post_id text REFERENCES posts(id) ON DELETE SET NULL,
  date date NOT NULL,
  impressions bigint CHECK (impressions IS NULL OR impressions >= 0),
  reach bigint CHECK (reach IS NULL OR reach >= 0),
  engagement bigint CHECK (engagement IS NULL OR engagement >= 0),
  clicks bigint CHECK (clicks IS NULL OR clicks >= 0),
  likes bigint CHECK (likes IS NULL OR likes >= 0),
  comments bigint CHECK (comments IS NULL OR comments >= 0),
  shares bigint CHECK (shares IS NULL OR shares >= 0),
  saves bigint CHECK (saves IS NULL OR saves >= 0),
  video_views bigint CHECK (video_views IS NULL OR video_views >= 0),
  source text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_snapshots_workspace_brand_date_idx ON analytics_snapshots (workspace_id, brand_id, date);
CREATE INDEX IF NOT EXISTS analytics_snapshots_post_idx ON analytics_snapshots (post_id);

CREATE TABLE IF NOT EXISTS ai_jobs (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('content', 'image', 'campaign', 'plan', 'recommendation')),
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  input jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  error text
);
CREATE INDEX IF NOT EXISTS ai_jobs_workspace_brand_idx ON ai_jobs (workspace_id, brand_id, created_at DESC);

CREATE TABLE IF NOT EXISTS channel_connections (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL,
  external_account_id text,
  external_account_name text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  connected_at timestamptz,
  updated_at timestamptz NOT NULL,
  last_error text
);
CREATE INDEX IF NOT EXISTS channel_connections_workspace_brand_idx ON channel_connections (workspace_id, brand_id);

CREATE TABLE IF NOT EXISTS channel_oauth_states (
  state text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('facebook', 'instagram')),
  connection_id text NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS channel_oauth_states_expiry_idx ON channel_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS channel_oauth_selections (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('facebook', 'instagram')),
  connection_id text NOT NULL REFERENCES channel_connections(id) ON DELETE CASCADE,
  candidates jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS publish_attempts (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id text NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  post_id text NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  connection_id text REFERENCES channel_connections(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  status text NOT NULL CHECK (status IN ('pending', 'running', 'published', 'failed')),
  requested_at timestamptz NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  external_id text,
  error text,
  retry_of text REFERENCES publish_attempts(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX IF NOT EXISTS publish_attempts_post_idx ON publish_attempts (post_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS publish_attempts_workspace_brand_idx ON publish_attempts (workspace_id, brand_id, requested_at DESC);

-- The current TanStack session is an encrypted httpOnly cookie. This table is
-- ready for a future server-side session adapter without changing the domain
-- model. It is intentionally not populated by the JSON migration.
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id text REFERENCES workspaces(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);
