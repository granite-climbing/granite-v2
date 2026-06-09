-- Granite Phase 5 — allow `no_mention_events` event_type on
-- webhook_operational_events.
--
-- Records inbound Meta POSTs that pass signature + JSON parse but yield zero
-- mention events after extraction. Useful for diagnosing payload shape drift
-- or webhooks fired for an unrelated field. SQLite has no
-- `ALTER TABLE ... DROP CONSTRAINT`, so the CHECK constraint is extended by
-- recreating the table. D1 runs each statement in its own transaction.

CREATE TABLE webhook_operational_events_new (
  id            TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'invalid_signature',
    'invalid_payload',
    'no_mention_events',
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

INSERT INTO webhook_operational_events_new (
  id, event_type, provider, webhook_id, beta_id, request_id,
  method, path, status_code, message, metadata, created_at
)
SELECT
  id, event_type, provider, webhook_id, beta_id, request_id,
  method, path, status_code, message, metadata, created_at
FROM webhook_operational_events;

DROP TABLE webhook_operational_events;

ALTER TABLE webhook_operational_events_new RENAME TO webhook_operational_events;

CREATE INDEX IF NOT EXISTS idx_webhook_operational_events_type ON webhook_operational_events (event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_operational_events_created_at ON webhook_operational_events (created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_operational_events_webhook_id ON webhook_operational_events (webhook_id);
