-- Granite Phase 5 — store canonical Instagram media_id on the webhook_inbox row.
-- For comment mentions, external_id is the comment_id, which is NOT the same as
-- the media id used by betas.external_media_id. Manual matching and duplicate
-- detection must compare on this canonical id to be safe.
-- Roll-forward only.

ALTER TABLE webhook_inbox ADD COLUMN external_media_id TEXT;

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_external_media_id
  ON webhook_inbox (external_media_id);
