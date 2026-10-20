-- Saved per-brand idea bank. It is a small JSON document on the existing
-- brand profile and is replaced only when the owner explicitly refreshes it.
ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS idea_bank jsonb
  CHECK (idea_bank IS NULL OR jsonb_typeof(idea_bank) = 'object');
