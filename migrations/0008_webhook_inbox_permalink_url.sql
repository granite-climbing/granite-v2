-- Granite Phase 5 — webhook_inbox.permalink_url
--
-- Persist the Instagram permalink resolved during fetchMentionedMedia so the
-- admin Webhook Inbox can link straight to the originating post (especially
-- useful while a row is still in `unmatched` and operators need to inspect
-- the caption / video manually).

ALTER TABLE webhook_inbox ADD COLUMN permalink_url TEXT;
