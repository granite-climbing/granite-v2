-- Granite Phase 6 user auth schema
-- Roll-forward only.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  email         TEXT,
  avatar_url    TEXT,
  instagram_id  TEXT,
  youtube_id    TEXT,
  gender        TEXT CHECK (gender IN ('male', 'female')),
  height_cm     INTEGER,
  ape_index_cm  INTEGER,
  top_bouldering_grade TEXT,
  top_sport_grade      TEXT,
  onboarding_completed_at TEXT,
  deleted_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_instagram_id ON users (instagram_id)
  WHERE instagram_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS user_oauth_identities (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('kakao', 'naver', 'google', 'apple')),
  provider_uid  TEXT NOT NULL,
  email_at_link TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_uid)
);

CREATE INDEX IF NOT EXISTS idx_user_oauth_identities_user_id ON user_oauth_identities (user_id);
CREATE INDEX IF NOT EXISTS idx_user_oauth_identities_user_provider ON user_oauth_identities (user_id, provider);
