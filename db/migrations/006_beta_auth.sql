-- Additive only. Existing accounts retain their previous access; new users require verification.
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_metadata jsonb;
ALTER TABLE post_variants ADD COLUMN IF NOT EXISTS manual_published_at timestamptz;
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_window_idx ON auth_rate_limits(window_start);
REVOKE ALL ON auth_rate_limits FROM PUBLIC;
