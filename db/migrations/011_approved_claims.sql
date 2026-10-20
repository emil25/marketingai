-- Claims in this list were explicitly confirmed by the business owner.
ALTER TABLE brand_profiles
  ADD COLUMN IF NOT EXISTS approved_claims jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(approved_claims) = 'array');
