-- Additive preference only. Existing records use Facebook; no post is changed.
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS main_channel text NOT NULL
  DEFAULT 'facebook' CHECK (main_channel IN ('facebook', 'instagram'));
