PRAGMA foreign_keys = ON;

CREATE TABLE areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE crags (
  id TEXT PRIMARY KEY,
  area_id TEXT NOT NULL REFERENCES areas(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  lat REAL,
  lng REAL,
  summary TEXT NOT NULL DEFAULT '',
  access_desc TEXT NOT NULL DEFAULT '',
  parking_desc TEXT NOT NULL DEFAULT '',
  season TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT NOT NULL DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sectors (
  id TEXT PRIMARY KEY,
  crag_id TEXT NOT NULL REFERENCES crags(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  lat REAL,
  lng REAL,
  summary TEXT NOT NULL DEFAULT '',
  access_desc TEXT NOT NULL DEFAULT '',
  parking_desc TEXT NOT NULL DEFAULT '',
  season TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT NOT NULL DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(crag_id, slug)
);

CREATE TABLE boulders (
  id TEXT PRIMARY KEY,
  sector_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  coord_precision TEXT NOT NULL DEFAULT 'exact' CHECK (coord_precision IN ('exact', 'approximate', 'hidden')),
  rock_type TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '[]',
  cover_image_url TEXT NOT NULL DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sector_id, slug)
);

CREATE TABLE topos (
  id TEXT PRIMARY KEY,
  boulder_id TEXT NOT NULL REFERENCES boulders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_image_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE routes (
  id TEXT PRIMARY KEY,
  topo_id TEXT NOT NULL REFERENCES topos(id) ON DELETE CASCADE,
  boulder_id TEXT NOT NULL REFERENCES boulders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  grade TEXT NOT NULL,
  grade_num INTEGER NOT NULL,
  fa TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  line_image_url TEXT NOT NULL DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(boulder_id, slug)
);

CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  cover_image_url TEXT NOT NULL DEFAULT '',
  crag_id TEXT REFERENCES crags(id) ON DELETE SET NULL,
  link_url TEXT NOT NULL DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admins (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_audit_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES admins(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT,
  instagram_id TEXT UNIQUE,
  height_cm INTEGER,
  arm_span_cm INTEGER,
  weight_kg INTEGER,
  youtube_id TEXT,
  avatar_url TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_oauth_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('kakao', 'naver', 'google', 'apple')),
  provider_uid TEXT NOT NULL,
  email_at_link TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_uid)
);

CREATE TABLE betas (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  instagram_id TEXT,
  source TEXT NOT NULL CHECK (source IN ('manual', 'instagram_webhook')),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden', 'removed')),
  claim_status TEXT NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed', 'claimed', 'verified', 'revoked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_inbox (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'instagram',
  external_id TEXT NOT NULL UNIQUE,
  ig_user_id TEXT,
  ig_username TEXT,
  caption TEXT NOT NULL DEFAULT '',
  media_url TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT NOT NULL DEFAULT '',
  matched_beta_id TEXT REFERENCES betas(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'matched', 'unmatched', 'manual_matched', 'rejected')),
  raw_payload TEXT NOT NULL DEFAULT '{}',
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('crag', 'sector', 'boulder', 'route')),
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX idx_crags_area ON crags(area_id);
CREATE INDEX idx_sectors_crag ON sectors(crag_id);
CREATE INDEX idx_boulders_sector ON boulders(sector_id);
CREATE INDEX idx_boulders_lat_lng ON boulders(lat, lng);
CREATE INDEX idx_topos_boulder ON topos(boulder_id);
CREATE INDEX idx_routes_topo ON routes(topo_id);
CREATE INDEX idx_routes_boulder ON routes(boulder_id);
CREATE INDEX idx_betas_route_status ON betas(route_id, status);
CREATE INDEX idx_betas_instagram_user ON betas(instagram_id, user_id);
CREATE INDEX idx_betas_platform_source ON betas(platform, source);
