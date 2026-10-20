-- Additive migration. Existing accounts start in simple mode; no content is changed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_mode text NOT NULL DEFAULT 'simple'
  CHECK (ui_mode IN ('simple', 'detailed'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_mode_suggestion_dismissed boolean NOT NULL DEFAULT false;
