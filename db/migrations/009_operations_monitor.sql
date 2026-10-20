-- Private server-only monitor leases and immutable, sanitized daily reports.
CREATE TABLE IF NOT EXISTS operations_monitor_runs (
  run_date date PRIMARY KEY,
  lease_token uuid NOT NULL,
  lease_until timestamptz NOT NULL,
  report jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (report IS NULL OR jsonb_typeof(report) = 'object')
);
REVOKE ALL ON operations_monitor_runs FROM PUBLIC;
CREATE INDEX IF NOT EXISTS ai_calls_operations_date_idx
  ON ai_calls ((coalesce(completed_at, created_at))) WHERE status = 'error';
