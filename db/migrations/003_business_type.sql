-- Additive migration: stores the stable business category in Brand Voice.
-- Existing brands remain valid and receive the neutral "other" value.
ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'other';

CREATE INDEX IF NOT EXISTS brand_profiles_business_type_idx
  ON brand_profiles (business_type);
