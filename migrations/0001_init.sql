-- Granite Phase 2 initial schema
-- Roll-forward only. Tables: areas, crags, sectors, boulders, topos, routes, announcements.

CREATE TABLE IF NOT EXISTS areas (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  name_en          TEXT,
  slug             TEXT NOT NULL UNIQUE,
  cover_image_url  TEXT NOT NULL DEFAULT '',
  is_published     INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crags (
  id               TEXT PRIMARY KEY,
  area_id          TEXT NOT NULL REFERENCES areas(id),
  name             TEXT NOT NULL,
  name_en          TEXT,
  slug             TEXT NOT NULL UNIQUE,
  lat              REAL,
  lng              REAL,
  description      TEXT NOT NULL DEFAULT '',
  season           TEXT NOT NULL DEFAULT '',
  cover_image_url  TEXT NOT NULL DEFAULT '',
  is_published     INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crags_area_id ON crags (area_id);

CREATE TABLE IF NOT EXISTS sectors (
  id               TEXT PRIMARY KEY,
  crag_id          TEXT NOT NULL REFERENCES crags(id),
  name             TEXT NOT NULL,
  name_en          TEXT,
  slug             TEXT NOT NULL,
  lat              REAL,
  lng              REAL,
  description      TEXT NOT NULL DEFAULT '',
  season           TEXT NOT NULL DEFAULT '',
  cover_image_url  TEXT NOT NULL DEFAULT '',
  is_published     INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (crag_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_sectors_crag_id ON sectors (crag_id);

CREATE TABLE IF NOT EXISTS boulders (
  id               TEXT PRIMARY KEY,
  sector_id        TEXT NOT NULL REFERENCES sectors(id),
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  lat              REAL NOT NULL,
  lng              REAL NOT NULL,
  hashtags         TEXT NOT NULL DEFAULT '[]',
  cover_image_url  TEXT NOT NULL DEFAULT '',
  is_published     INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (sector_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_boulders_sector_id ON boulders (sector_id);

CREATE TABLE IF NOT EXISTS topos (
  id               TEXT PRIMARY KEY,
  boulder_id       TEXT NOT NULL REFERENCES boulders(id),
  name             TEXT NOT NULL,
  base_image_url   TEXT NOT NULL DEFAULT '',
  is_published     INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_topos_boulder_id ON topos (boulder_id);

CREATE TABLE IF NOT EXISTS routes (
  id               TEXT PRIMARY KEY,
  topo_id          TEXT NOT NULL REFERENCES topos(id),
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  grade            TEXT NOT NULL,
  grade_num        INTEGER NOT NULL,
  fa               TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  line_image_url   TEXT NOT NULL DEFAULT '',
  is_published     INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (topo_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_routes_topo_id ON routes (topo_id);

CREATE TABLE IF NOT EXISTS announcements (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL DEFAULT '',
  cover_image_url  TEXT NOT NULL DEFAULT '',
  crag_id          TEXT REFERENCES crags(id),
  link_url         TEXT NOT NULL DEFAULT '',
  is_published     INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  published_at     TEXT NOT NULL DEFAULT '',
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_announcements_crag_id ON announcements (crag_id);
