-- Server-only operational audit; no prompts, completions or credentials.
CREATE TABLE IF NOT EXISTS ai_calls (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Keep the user's daily count when a brand/membership/workspace is removed.
  -- Only user deletion removes the operational record completely.
  workspace_id text REFERENCES workspaces(id) ON DELETE SET NULL,
  brand_id text REFERENCES brands(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  model text NOT NULL,
  input_tokens bigint CHECK (input_tokens >= 0),
  output_tokens bigint CHECK (output_tokens >= 0),
  cost numeric CHECK (cost >= 0),
  latency_ms integer CHECK (latency_ms >= 0),
  status text NOT NULL CHECK (status IN ('pending', 'success', 'error')),
  http_status integer,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  FOREIGN KEY (workspace_id, user_id) REFERENCES memberships(workspace_id, user_id) ON DELETE SET NULL (workspace_id),
  FOREIGN KEY (workspace_id, brand_id) REFERENCES brands(workspace_id, id) ON DELETE SET NULL (brand_id)
);
CREATE INDEX IF NOT EXISTS ai_calls_user_day_idx ON ai_calls (user_id, created_at);
CREATE INDEX IF NOT EXISTS ai_calls_workspace_date_idx ON ai_calls (workspace_id, created_at);
REVOKE ALL ON ai_calls FROM PUBLIC;
