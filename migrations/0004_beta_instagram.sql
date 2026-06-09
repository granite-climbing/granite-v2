-- Granite Phase 5 beta / instagram
-- Roll-forward only.

CREATE TABLE IF NOT EXISTS betas (
  id              TEXT PRIMARY KEY,
  route_id        TEXT NOT NULL REFERENCES routes(id),
  user_id         TEXT,
  instagram_id    TEXT NOT NULL DEFAULT '',
  display_name    TEXT NOT NULL DEFAULT '',
  source          TEXT NOT NULL CHECK (source IN ('manual', 'instagram_webhook')),
  platform        TEXT NOT NULL CHECK (platform IN ('instagram', 'youtube')),
  media_url       TEXT NOT NULL,
  permalink_url   TEXT,
  external_media_id TEXT,
  thumbnail_url   TEXT,
  sent_at         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden', 'removed')),
  claim_status    TEXT NOT NULL DEFAULT 'unclaimed' CHECK (claim_status IN ('unclaimed', 'claimed', 'verified', 'revoked')),
  moderation_note TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_betas_route_id ON betas (route_id);
CREATE INDEX IF NOT EXISTS idx_betas_instagram_id ON betas (instagram_id);
CREATE INDEX IF NOT EXISTS idx_betas_external_media_id ON betas (external_media_id);
CREATE INDEX IF NOT EXISTS idx_betas_status ON betas (status);
CREATE INDEX IF NOT EXISTS idx_betas_claim_status ON betas (claim_status);
CREATE INDEX IF NOT EXISTS idx_betas_source_platform ON betas (source, platform);
CREATE INDEX IF NOT EXISTS idx_betas_sent_at ON betas (sent_at);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_betas_platform_external_media
  ON betas (platform, external_media_id)
  WHERE external_media_id IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_betas_platform_permalink
  ON betas (platform, permalink_url)
  WHERE permalink_url IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS webhook_inbox (
  id              TEXT PRIMARY KEY,
  provider        TEXT NOT NULL CHECK (provider IN ('instagram')),
  external_id     TEXT NOT NULL UNIQUE,
  ig_user_id      TEXT NOT NULL DEFAULT '',
  ig_username     TEXT NOT NULL DEFAULT '',
  caption         TEXT NOT NULL DEFAULT '',
  media_url       TEXT NOT NULL DEFAULT '',
  thumbnail_url   TEXT,
  matched_beta_id TEXT REFERENCES betas(id),
  status          TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'matched', 'unmatched', 'manual_matched', 'rejected', 'duplicate', 'failed')),
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT NOT NULL DEFAULT '',
  last_error_message TEXT NOT NULL DEFAULT '',
  raw_payload     TEXT NOT NULL,
  received_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_status ON webhook_inbox (status);
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_ig_username ON webhook_inbox (ig_username);
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_received_at ON webhook_inbox (received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_inbox_matched_beta_id ON webhook_inbox (matched_beta_id);

CREATE TABLE IF NOT EXISTS webhook_operational_events (
  id            TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'invalid_signature',
    'graph_api_failure',
    'caption_parse_failed',
    'route_match_ambiguous',
    'duplicate_beta',
    'thumbnail_lookup_failed',
    'thumbnail_copy_failed'
  )),
  provider      TEXT NOT NULL DEFAULT 'instagram',
  webhook_id    TEXT REFERENCES webhook_inbox(id),
  beta_id       TEXT REFERENCES betas(id),
  request_id    TEXT NOT NULL DEFAULT '',
  method        TEXT NOT NULL DEFAULT '',
  path          TEXT NOT NULL DEFAULT '',
  status_code   INTEGER,
  message       TEXT NOT NULL DEFAULT '',
  metadata      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_operational_events_type ON webhook_operational_events (event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_operational_events_created_at ON webhook_operational_events (created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_operational_events_webhook_id ON webhook_operational_events (webhook_id);
