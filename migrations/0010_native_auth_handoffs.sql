CREATE TABLE IF NOT EXISTS native_auth_handoffs (
  id          TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL UNIQUE,
  token       TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  consumed_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_native_auth_handoffs_lookup
  ON native_auth_handoffs (code_hash, expires_at, consumed_at);
