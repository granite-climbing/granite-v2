-- Granite Phase 10 user records (완등 기록)
-- Roll-forward only.

CREATE TABLE IF NOT EXISTS user_records (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  route_id   TEXT NOT NULL REFERENCES routes(id),
  beta_id    TEXT REFERENCES betas(id),
  sent_at    TEXT NOT NULL,
  rating     INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_records_user_id ON user_records (user_id);
CREATE INDEX IF NOT EXISTS idx_user_records_route_id ON user_records (route_id);
