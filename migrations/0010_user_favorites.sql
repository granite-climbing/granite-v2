-- Granite Phase 8 user favorites schema
-- Roll-forward only.

CREATE TABLE IF NOT EXISTS favorites (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('route')),
  target_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created_at
  ON favorites (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_favorites_target
  ON favorites (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_favorites_user_target
  ON favorites (user_id, target_type, target_id);
