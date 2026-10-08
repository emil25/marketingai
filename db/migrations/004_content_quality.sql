-- Additive: existing brands, posts and plans remain intact.
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
ALTER TABLE brand_profiles ADD COLUMN IF NOT EXISTS opening_hours text NOT NULL DEFAULT '';
ALTER TABLE post_variants ADD COLUMN IF NOT EXISTS verification_warnings jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS draft_content text NOT NULL DEFAULT '';
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS visual_idea text NOT NULL DEFAULT '';
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS verification_warnings jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE plan_items ADD COLUMN IF NOT EXISTS topic_summary text NOT NULL DEFAULT '';
