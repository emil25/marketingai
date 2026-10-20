-- Additive Transylvanian market preferences. Existing brand profiles keep their values.
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '';
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS house_number text NOT NULL DEFAULT '';
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS county text NOT NULL DEFAULT '';
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS city_name_mode text NOT NULL DEFAULT 'hu'
  CHECK (city_name_mode IN ('hu', 'ro', 'both'));
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS local_phrases text NOT NULL DEFAULT '';
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS local_events text NOT NULL DEFAULT '';
