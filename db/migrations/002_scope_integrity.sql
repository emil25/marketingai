-- Enforce that every brand-owned row uses a brand from the same workspace.
-- The application already performs these checks; these composite foreign keys
-- make the invariant hold for direct database access as well.

CREATE UNIQUE INDEX IF NOT EXISTS brands_workspace_id_id_key ON brands (workspace_id, id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_brand_scope_fk') THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT campaigns_brand_scope_fk
      FOREIGN KEY (workspace_id, brand_id) REFERENCES brands (workspace_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_brand_scope_fk') THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_brand_scope_fk
      FOREIGN KEY (workspace_id, brand_id) REFERENCES brands (workspace_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_items_brand_scope_fk') THEN
    ALTER TABLE plan_items
      ADD CONSTRAINT plan_items_brand_scope_fk
      FOREIGN KEY (workspace_id, brand_id) REFERENCES brands (workspace_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'media_assets_brand_scope_fk') THEN
    ALTER TABLE media_assets
      ADD CONSTRAINT media_assets_brand_scope_fk
      FOREIGN KEY (workspace_id, brand_id) REFERENCES brands (workspace_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_snapshots_brand_scope_fk') THEN
    ALTER TABLE analytics_snapshots
      ADD CONSTRAINT analytics_snapshots_brand_scope_fk
      FOREIGN KEY (workspace_id, brand_id) REFERENCES brands (workspace_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_jobs_brand_scope_fk') THEN
    ALTER TABLE ai_jobs
      ADD CONSTRAINT ai_jobs_brand_scope_fk
      FOREIGN KEY (workspace_id, brand_id) REFERENCES brands (workspace_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'channel_connections_brand_scope_fk') THEN
    ALTER TABLE channel_connections
      ADD CONSTRAINT channel_connections_brand_scope_fk
      FOREIGN KEY (workspace_id, brand_id) REFERENCES brands (workspace_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'channel_oauth_states_brand_scope_fk') THEN
    ALTER TABLE channel_oauth_states
      ADD CONSTRAINT channel_oauth_states_brand_scope_fk
      FOREIGN KEY (workspace_id, brand_id) REFERENCES brands (workspace_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'channel_oauth_selections_brand_scope_fk') THEN
    ALTER TABLE channel_oauth_selections
      ADD CONSTRAINT channel_oauth_selections_brand_scope_fk
      FOREIGN KEY (workspace_id, brand_id) REFERENCES brands (workspace_id, id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publish_attempts_brand_scope_fk') THEN
    ALTER TABLE publish_attempts
      ADD CONSTRAINT publish_attempts_brand_scope_fk
      FOREIGN KEY (workspace_id, brand_id) REFERENCES brands (workspace_id, id) ON DELETE CASCADE;
  END IF;
END $$;
