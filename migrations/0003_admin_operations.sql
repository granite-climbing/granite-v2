-- Granite Phase 3 admin operations
-- Roll-forward only.

CREATE TABLE IF NOT EXISTS admins (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins (email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins (is_active);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL REFERENCES admins(id),
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  metadata    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON admin_audit_logs (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs (created_at);

ALTER TABLE areas ADD COLUMN deleted_at TEXT;
ALTER TABLE crags ADD COLUMN deleted_at TEXT;
ALTER TABLE sectors ADD COLUMN deleted_at TEXT;
ALTER TABLE boulders ADD COLUMN deleted_at TEXT;
ALTER TABLE topos ADD COLUMN deleted_at TEXT;
ALTER TABLE routes ADD COLUMN deleted_at TEXT;
ALTER TABLE announcements ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_areas_deleted_at ON areas (deleted_at);
CREATE INDEX IF NOT EXISTS idx_crags_deleted_at ON crags (deleted_at);
CREATE INDEX IF NOT EXISTS idx_sectors_deleted_at ON sectors (deleted_at);
CREATE INDEX IF NOT EXISTS idx_boulders_deleted_at ON boulders (deleted_at);
CREATE INDEX IF NOT EXISTS idx_topos_deleted_at ON topos (deleted_at);
CREATE INDEX IF NOT EXISTS idx_routes_deleted_at ON routes (deleted_at);
CREATE INDEX IF NOT EXISTS idx_announcements_deleted_at ON announcements (deleted_at);
