# Granite Phase 5 Beta / Instagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 5 as a login-free Beta collection and moderation release: Instagram caption sharing, Instagram mention webhook ingestion, manual Instagram/YouTube Beta registration, unclaimed Beta records, and admin review flows.

**Architecture:** Keep public/admin mutations in Next.js Server Actions and database access inside `lib/db/`. Put Instagram webhook `GET/POST /webhooks/instagram` in a Cloudflare Worker because Meta requires a stable HTTP endpoint, challenge echo, fast ACK, and HMAC verification. Store Beta and webhook state in D1 via roll-forward migration, keep all Phase 5 Beta records unclaimed (`user_id = NULL`), and defer OAuth, favorites, claims, and personal record management to Phase 6.

**Tech Stack:** Next.js App Router, Server Components by default, Server Actions for public/admin mutations, Cloudflare Workers for Instagram webhook, Cloudflare D1 HTTP API, Cloudflare R2/CDN for thumbnails, TypeScript strict, Zod, Vitest.

---

## Phase 5 Required Items

### External Setup

- [ ] Prepare Granite Instagram business or creator account.
- [ ] Create Meta for Developers app and configure Instagram Graph API product.
- [ ] Request required Instagram mention/webhook permissions and submit app review.
- [ ] Decide production Worker domain from the deployed `granite-workers` Worker route and use `/webhooks/instagram` as the callback path.
- [ ] Register webhook callback URL and verify `hub.challenge`.
- [ ] Create `META_APP_SECRET` and `META_WEBHOOK_VERIFY_TOKEN`.
- [ ] Create a long-lived Instagram Graph API access token for the connected Granite professional account.
- [ ] Store Worker secrets with `pnpm wrangler secret put META_APP_SECRET`, `pnpm wrangler secret put META_WEBHOOK_VERIFY_TOKEN`, and `pnpm wrangler secret put INSTAGRAM_GRAPH_ACCESS_TOKEN`.
- [ ] Configure web app environment variables for manual URL thumbnail lookup: `META_APP_ID`, `META_APP_SECRET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, and `CDN_BASE_URL`.
- [ ] Confirm raw webhook payload retention period for privacy policy/SOP.
- [ ] Confirm caption normalization policy for same-name Boulder/Route collisions: automatic match only when exactly one published Route candidate remains; otherwise send to admin inbox.
- [ ] Confirm Graph API access token expiry date, renewal owner, and renewal SOP before production launch.

### Product Scope

- [x] Route/Topo UI can generate and copy Instagram caption for any published Route.
- [x] Route/Topo UI can submit manual Beta with Instagram/YouTube URL, display name, Instagram handle, and sent date without login.
- [x] Manual Beta is saved as `source='manual'`, `platform='instagram'|'youtube'`, `user_id=NULL`, `claim_status='unclaimed'`, `status='pending'`.
- [x] Instagram webhook accepts Meta verification `GET`.
- [x] Instagram webhook verifies `X-Hub-Signature-256` on `POST`.
- [x] Instagram webhook stores original event in `webhook_inbox` with unique `external_id`.
- [x] Instagram webhook parses caption, matches Route by normalized Boulder/Route hashtag combination, creates unclaimed Beta on exactly one match, and marks ambiguous/missing matches as `unmatched`.
- [x] Admin can review webhook inbox entries, manually match to a Route, or reject.
- [x] Admin can review Beta records, approve, hide, or remove.
- [x] Public Beta grid shows only `status='approved'` Betas. `pending`, `hidden`, and `removed` never appear publicly.
- [x] Thumbnail collection is attempted but non-blocking; Beta creation must survive thumbnail failure.
- [x] Every thumbnail source from Instagram/YouTube APIs or HTML fallback is copied to R2 immediately; `betas.thumbnail_url` stores only Granite CDN URLs or `NULL`.
- [x] Duplicate Beta creation is prevented across manual submissions, webhook retries, and admin manual matching.
- [x] Admin can inspect webhook/Beta operational health: duplicate drops, invalid signatures, Graph API failures, unmatched events, and thumbnail copy failures (read-only visibility; automatic retry is out of scope for Phase 5).

### Out Of Scope

- OAuth login, user sessions, profile editing, favorites/projects, my records, and unclaimed Beta claim flows.
- Public user profile pages and ownership display for unclaimed Beta.
- Full analytics dashboard for Beta statistics.
- Queue-backed background processing (Cloudflare Queues pipeline).
- **Scheduled retry worker (cron-based automatic re-processing).** Failed webhook events stay visible in `/admin/webhooks` with `last_error_code`/`last_error_message` for operator awareness; automatic re-processing and `next_retry_at`-driven retry are deferred. Re-delivery happens out-of-band (Meta App Dashboard redelivery) or via the existing manual Beta submission flow.
- **Manual submission rate limiting / abuse mitigation** (Cloudflare Turnstile, IP throttling, per-route cooldown). Phase 5 ships login-free without rate limit; spam and duplicate abuse are addressed only by admin moderation and the unique `(platform, permalink_url)` index.
- **Beta moderation SLA / review cadence.** No operational SLA is committed in Phase 5; admins moderate ad-hoc.
- Webhook `unmatched`/`failed` admin notification channel (email/Slack). See Future Work.

### Future Work (Phase 6+)

- **Webhook admin notification channel.** Push notifications to admins (email or Slack incoming webhook) when `webhook_inbox` rows land in `unmatched` or `failed` so operators do not need to poll `/admin/webhooks`. Trigger: insert/update transitions into those statuses. Not implemented in Phase 5; defer to Phase 6 or a dedicated ops follow-up.

---

## Instagram / Meta API Data Collection Guide

This section documents the real Meta/Instagram API surfaces Phase 5 may use, the expected payload shape, and what Granite can safely persist. API versions in examples use `v21.0` because that is the version selected in the current Phase 5 research notes. During implementation, verify the latest supported Graph API version in Meta App Dashboard and update request URLs consistently.

### Official References Checked

| API surface | Official reference |
|-------------|--------------------|
| Instagram oEmbed | https://developers.facebook.com/docs/instagram-platform/oembed |
| Instagram Hashtag Top Media | https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag/top-media |
| Instagram Mentioned Media | https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/mentioned_media |
| Instagram Mentioned Comment | https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/mentioned_comment |
| Graph API Webhooks signature validation | https://developers.facebook.com/docs/graph-api/webhooks/getting-started |

Meta oEmbed docs state that oEmbed can return embed HTML and basic metadata for public Instagram photo, video, Reel, and Feed posts. They also state `GET /instagram_oembed` supports a `fields` parameter and show `thumbnail_url` and `author_name` in the thumbnail response. The docs require app review for oEmbed Read Advanced Access, and private/inactive/age-restricted accounts, disabled embeds, and Stories are not supported.

Graph API Webhooks payloads are signed with an `X-Hub-Signature-256` header. The Worker must verify the raw request body before JSON parsing. Do not compute HMAC against a re-serialized object.

### Stored Field Semantics

| Granite field | Meaning | Notes |
|----------------|---------|-------|
| `betas.media_url` | Required source media URL | For manual URL input, this is the user-submitted Instagram/YouTube URL. For webhook mentions, this is `mentioned_media.media_url` when available, or `permalink` if the API returns no separate media URL. |
| `betas.thumbnail_url` | Granite CDN URL after R2 copy | Do not persist Instagram CDN URLs as the final value because they can expire. Beta creation must not fail when thumbnail lookup or R2 upload fails; in that case keep `thumbnail_url = NULL`. |
| `betas.instagram_id` | Username/handle string, not numeric IG user id | oEmbed returns `author_name`; mentioned media can return `username`. Normalize by stripping leading `@` and lowercasing. |
| `betas.external_media_id` | Provider media id, such as Instagram `media_id` | Add this nullable column in Phase 5 so webhook-created Betas can retain the only reliable media identifier even when no permalink is available. |
| `betas.permalink_url` | Canonical provider post URL, if available | For manual URL input and hashtag search, this normally equals the submitted or returned post URL. For webhook mentions, set it only when Graph API returns `permalink`; never guess it from numeric `media_id`. |
| `webhook_inbox.external_id` | Webhook idempotency key | Use Instagram `media_id` for caption mentions and `comment_id` for comment mentions when present; for comment mentions, also retain `media_id` in raw payload. |
| `webhook_inbox.raw_payload` | Raw incoming webhook notification JSON | Store the notification payload, not access tokens or follow-up API responses containing secrets. |
| `webhook_operational_events` | Read-only operational event log | Stores non-content operational events such as invalid signatures, Graph API failures, duplicates, and thumbnail copy failures for admin visibility. Do not store raw invalid-signature request bodies. |

Important correction: Instagram `/p/{...}/` URLs use a shortcode, not the numeric Graph `media_id`. A webhook `media_id` such as `17918195224117851` must not be blindly converted into `https://www.instagram.com/p/17918195224117851/` and treated as a valid canonical post URL. If a follow-up API call does not return `permalink`, store `external_media_id` and leave `permalink_url` null.

### Method 1: User Enters Instagram URL Directly

This is in Phase 5 scope as part of non-login manual Beta registration.

| Item | Collection method | API call |
|------|-------------------|----------|
| Thumbnail URL | First try oEmbed `thumbnail_url`; if oEmbed fails, fetch the public post HTML and parse `og:image` / `twitter:image` / JSON-LD image metadata | `GET https://graph.facebook.com/v21.0/instagram_oembed?url={permalink}&fields=thumbnail_url,author_name,provider_name,provider_url&access_token={APP_ID}|{APP_SECRET}` |
| Author username | oEmbed `author_name` | Same request |
| Post URL | User input URL | No API call required |

Expected oEmbed thumbnail response:

```json
{
  "thumbnail_url": "https://scontent.cdninstagram.com/v/t51.2885-15/...",
  "author_name": "climber_username",
  "provider_name": "Instagram",
  "provider_url": "https://www.instagram.com/"
}
```

Implementation decision:
- The manual form still accepts a user-entered `instagramId` because oEmbed can be unavailable before app review or for unsupported posts.
- If oEmbed succeeds, use `author_name` to prefill or validate the normalized handle only when it does not conflict with user input.
- If oEmbed fails, do not fail manual Beta creation. Fetch the submitted Instagram URL as HTML and parse thumbnail candidates in this order: `<meta property="og:image">`, `<meta name="twitter:image">`, then JSON-LD `image`.
- Download the selected thumbnail immediately, upload it to R2 under `betas/{betaId}/thumb-{uuid}.{ext}`, and store only the Granite CDN URL in `betas.thumbnail_url`.
- If both oEmbed and HTML metadata parsing fail, or if R2 upload fails, keep the Beta row and set `thumbnail_url = NULL`.

Constraints:
- oEmbed Read requires Advanced Access and Meta App Review for production use.
- oEmbed is intended for embedding/rendering public Instagram content. The plan must keep attribution and link to the Instagram post when rendering thumbnails from oEmbed-derived data.
- oEmbed returns username-style `author_name`, not numeric user id.
- Private, inactive, age-restricted, disabled-embed posts and Stories are unsupported.
- HTML fallback is best effort. Instagram can change markup, block requests, or omit metadata, so the fallback must be isolated in a small helper with tests and clear failure handling.

### Method 2: Admin Searches Hashtag and Selects Media

This is useful for an admin assisted registration workflow, but it is not required for the first Phase 5 release unless the implementation team chooses it as an admin enhancement after webhook/manual flows are stable.

| Item | Collection method | API call |
|------|-------------------|----------|
| Thumbnail URL | `top_media` `media_url` when media type supports it | `GET https://graph.facebook.com/v21.0/{hashtag-id}/top_media?user_id={ig-user-id}&fields=id,media_type,media_url,permalink,timestamp&access_token={token}` |
| Author username | oEmbed `author_name` using selected `permalink` | `GET https://graph.facebook.com/v21.0/instagram_oembed?url={permalink}&fields=author_name&access_token={APP_ID}|{APP_SECRET}` |
| Post URL | `top_media` `permalink` | Returned by the `top_media` request |

Expected `top_media` item:

```json
{
  "id": "17918195224117851",
  "media_type": "IMAGE",
  "media_url": "https://scontent.cdninstagram.com/v/...",
  "permalink": "https://www.instagram.com/p/shortcode/",
  "timestamp": "2026-06-02T12:34:56+0000"
}
```

Constraints:
- `top_media` does not provide author username in the planned fields, so oEmbed is needed after selecting a media item.
- `CAROUSEL_ALBUM` may not return a usable `media_url`; the admin UI must tolerate missing thumbnails.
- Instagram hashtag search has platform limits, including a limit on the number of unique hashtags queried over a rolling period. Confirm exact current limit in Meta docs before implementing this optional flow.
- Do not call oEmbed for every search result on every search; call it only after an admin selects a media item.

### Method 3: Caption `@granite.kr` Mention Webhook

This is the main automatic Phase 5 path.

Incoming webhook notification shape:

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "{ig-user-id}",
      "changes": [
        {
          "field": "mentions",
          "value": {
            "media_id": "17918195224117851"
          }
        }
      ]
    }
  ]
}
```

Follow-up data collection:

| Item | Collection method | API call |
|------|-------------------|----------|
| Caption text | `mentioned_media` `caption` | `GET https://graph.facebook.com/v21.0/{ig-user-id}?fields=mentioned_media.media_id({media-id}){thumbnail_url,media_url,caption,username,media_type,permalink}&access_token={token}` |
| Thumbnail URL | Prefer `thumbnail_url`; fallback to `media_url` | Same request |
| Author username | `mentioned_media` `username` | Same request |
| Post URL | Prefer `mentioned_media` `permalink` if returned | Same request; if absent, store `external_media_id` and do not fabricate `/p/{media-id}/` |

Expected follow-up response shape:

```json
{
  "mentioned_media": {
    "id": "17918195224117851",
    "media_type": "VIDEO",
    "thumbnail_url": "https://scontent.cdninstagram.com/v/...",
    "media_url": "https://video.cdninstagram.com/o1/v/...",
    "caption": "\"큰바위_Sky Hook\" @granite.kr #큰바위 #SkyHook",
    "username": "climber_username",
    "permalink": "https://www.instagram.com/p/shortcode/"
  },
  "id": "{ig-user-id}"
}
```

Matching rule:
- Parse both hashtag format (`#큰바위 #SkyHook`) and quoted title format (`"큰바위_Sky Hook"` or smart quotes).
- Automatic match succeeds only when exactly one published Route candidate matches normalized Boulder + Route tokens.
- If zero or multiple candidates match, insert/keep `webhook_inbox.status='unmatched'` for admin review.

Constraints:
- The webhook notification itself only contains ids; it does not include caption, username, thumbnail, or permalink.
- Fetch follow-up data with the connected Granite Instagram professional account token.
- If `permalink` is not available from `mentioned_media`, do not guess a shortcode URL from numeric `media_id`.

### Method 4: Comment `@granite.kr` Mention Webhook

This can be supported by the same Worker parser, but it should be treated as secondary to caption mentions unless product wants comment-based registration in the first Phase 5 cut.

Incoming webhook notification shape:

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "{ig-user-id}",
      "changes": [
        {
          "field": "mentions",
          "value": {
            "media_id": "17918195224117851",
            "comment_id": "17894227972186120"
          }
        }
      ]
    }
  ]
}
```

Step 1: fetch comment text and media reference:

| Item | API call |
|------|----------|
| Comment text and media id | `GET https://graph.facebook.com/v21.0/{ig-user-id}?fields=mentioned_comment.comment_id({comment-id}){text,media}&access_token={token}` |

Expected comment response shape:

```json
{
  "mentioned_comment": {
    "id": "17894227972186120",
    "text": "\"큰바위_Sky Hook\" @granite.kr",
    "media": {
      "id": "17918195224117851"
    }
  },
  "id": "{ig-user-id}"
}
```

Step 2: fetch media details:

| Item | Collection method | API call |
|------|-------------------|----------|
| Thumbnail URL | Prefer `mentioned_media.thumbnail_url`; fallback to `mentioned_media.media_url` | `GET https://graph.facebook.com/v21.0/{ig-user-id}?fields=mentioned_media.media_id({media-id}){thumbnail_url,media_url,username,media_type,permalink}&access_token={token}` |
| Author username | `mentioned_media.username` | Same request |
| Post URL | Prefer `mentioned_media.permalink` if returned | Same request; otherwise store `external_media_id` and no canonical permalink |

Constraints:
- If `comment_id` exists, call `mentioned_comment` first because the comment text is the Route matching input.
- Then call `mentioned_media` to get author/media metadata.
- The comment text plays the same role as caption for parsing.

### Data Source Summary

| Method | Thumbnail source | Username source | Post URL source |
|--------|------------------|-----------------|-----------------|
| User URL input | oEmbed `thumbnail_url`; fallback HTML `og:image` / `twitter:image` / JSON-LD image; then R2 CDN URL | oEmbed `author_name`, or user-entered handle if oEmbed unavailable | User input URL |
| Admin hashtag selection | `top_media.media_url`; then R2 CDN URL | oEmbed `author_name` after selection | `top_media.permalink` |
| Caption mention webhook | `mentioned_media.thumbnail_url`, fallback `media_url`; then R2 CDN URL | `mentioned_media.username` | `mentioned_media.permalink` if returned; otherwise no canonical URL |
| Comment mention webhook | `mentioned_media.thumbnail_url`, fallback `media_url`; then R2 CDN URL | `mentioned_media.username` | `mentioned_media.permalink` if returned; otherwise no canonical URL |

### Data Retention and Compliance Notes

- Store `raw_payload` only for webhook audit and matching diagnostics.
- Store follow-up Graph API response bodies only if needed for debugging, and never store access tokens.
- When rendering oEmbed-derived thumbnails, include attribution and a link to the Instagram post as required by Meta oEmbed guidance.
- Never persist Instagram CDN thumbnail URLs as the final durable thumbnail reference. They can expire. Persist the R2/CDN copy URL, or `NULL` if copying fails.
- If API access is not approved yet, manual Beta registration must still work with user-entered URL, display name, handle, and either an HTML-fallback R2 thumbnail or `thumbnail_url = NULL`.

---

## File Structure

### Database and Types

- Create: `migrations/0004_beta_instagram.sql` — `betas`, `webhook_inbox`, indexes, enum-like CHECK constraints.
- Modify: `lib/db/schema.ts` — exported `Beta`, `WebhookInbox`, list row, form row, status union types.
- Create: `lib/db/beta-queries.ts` — public/admin Beta reads and writes.
- Create: `lib/db/beta-queries.test.ts` — query shape and mapper tests with mocked D1 calls.
- Create: `lib/beta/normalize.ts` — hashtag, handle, caption, URL, date normalization helpers shared by Next and Worker.
- Create: `lib/beta/normalize.test.ts` — collision-safe normalization tests.
- Create: `lib/beta/caption.ts` — caption generation for Route context.
- Create: `lib/beta/caption.test.ts` — generated caption tests.

### Public UI and Actions

- Create: `lib/actions/beta-schema.ts` — Zod parsing for manual Beta form.
- Create: `lib/actions/beta.ts` — `submitManualBetaAction`.
- Create: `lib/actions/beta.test.ts` — Server Action validation and insert behavior.
- Modify: `lib/db/repository.ts` — expose Route context required by caption/manual submission.
- Modify: `app/(site)/t/[topoId]/page.tsx` — render Beta controls for each route row.
- Create: `components/public/beta-route-actions.tsx` — client leaf for the route row beta button; opens the Figma beta video bottom sheet.
- Create: `components/public/beta-video-sheet.tsx` — Figma node `1:1421` bottom sheet: dim overlay, title, close icon, caption box, CTA buttons, beta thumbnail grid.
- Create: `components/public/beta-video-grid.tsx` — 3-column beta thumbnail grid using approved Beta rows.
- Create: `components/public/manual-beta-form.tsx` — client form UI using the Server Action.

### Admin UI and Actions

- Create: `lib/actions/admin-beta.ts` — approve/hide/remove Beta, manual-match/reject webhook inbox entry.
- Create: `lib/actions/admin-beta.test.ts` — admin guard, audit, and state transition tests.
- Create: `app/admin/(protected)/betas/page.tsx` — Beta moderation list.
- Create: `app/admin/(protected)/webhooks/page.tsx` — webhook inbox list with route picker.
- Modify: `components/admin/admin-shell.tsx` — add navigation links for Betas and Webhooks if the shell owns nav.

### Worker

- Create: `workers/instagram-webhook/package.json` — Worker-local scripts if needed.
- Create: `workers/instagram-webhook/src/index.ts` — `GET/POST /webhooks/instagram` routing.
- Create: `workers/instagram-webhook/src/hmac.ts` — Meta signature verification.
- Create: `workers/instagram-webhook/src/payload.ts` — extract mention event fields from Meta payload.
- Create: `workers/instagram-webhook/src/match.ts` — caption token matching and Beta creation.
- Create: `workers/instagram-webhook/src/d1.ts` — D1 binding query helpers.
- Create: `workers/instagram-webhook/src/thumbnail.ts` — non-blocking thumbnail extraction/store attempt.
- Create: `workers/instagram-webhook/src/index.test.ts` — challenge, HMAC, idempotency, match/unmatched tests.
- Modify: `wrangler.toml` — add Worker entry, D1/R2 bindings, Seoul-friendly compatibility date.

### Docs and Release

- Create: `docs/admin-beta-operations.md` — admin inbox and Beta moderation SOP.
- Modify: `docs/deployment.md` — Worker secrets, deploy order, Meta webhook registration.
- Modify: `docs/DATA_MODEL.md` — concrete Phase 5 table columns after migration.
- Modify: `docs/ROADMAP.md` — mark Phase 5 implementation checkpoints as complete when shipped.

---

## Task 1: Phase 5 Schema Migration

**Files:**
- Create: `migrations/0004_beta_instagram.sql`
- Modify: `lib/db/schema.ts`
- Modify: `docs/DATA_MODEL.md`

- [x] **Step 1: Write migration SQL.**

Create `migrations/0004_beta_instagram.sql`:

```sql
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
```

- [x] **Step 2: Add exported TS model types.**

Add these types to `lib/db/schema.ts`:

```ts
export type BetaSource = "manual" | "instagram_webhook";
export type BetaPlatform = "instagram" | "youtube";
export type BetaStatus = "pending" | "approved" | "hidden" | "removed";
export type BetaClaimStatus = "unclaimed" | "claimed" | "verified" | "revoked";
export type WebhookInboxStatus =
  | "received"
  | "processing"
  | "matched"
  | "unmatched"
  | "manual_matched"
  | "rejected"
  | "duplicate"
  | "failed";

export type Beta = {
  id: string;
  routeId: string;
  userId: string | null;
  instagramId: string;
  displayName: string;
  source: BetaSource;
  platform: BetaPlatform;
  mediaUrl: string;
  permalinkUrl: string | null;
  externalMediaId: string | null;
  thumbnailUrl: string | null;
  sentAt: string;
  status: BetaStatus;
  claimStatus: BetaClaimStatus;
  moderationNote: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type WebhookInbox = {
  id: string;
  provider: "instagram";
  externalId: string;
  igUserId: string;
  igUsername: string;
  caption: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  matchedBetaId: string | null;
  status: WebhookInboxStatus;
  processingAttempts: number;
  lastErrorCode: string;
  lastErrorMessage: string;
  rawPayload: string;
  receivedAt: string;
  updatedAt: string;
};

export type WebhookOperationalEventType =
  | "invalid_signature"
  | "graph_api_failure"
  | "caption_parse_failed"
  | "route_match_ambiguous"
  | "duplicate_beta"
  | "thumbnail_lookup_failed"
  | "thumbnail_copy_failed";

export type WebhookOperationalEvent = {
  id: string;
  eventType: WebhookOperationalEventType;
  provider: "instagram";
  webhookId: string | null;
  betaId: string | null;
  requestId: string;
  method: string;
  path: string;
  statusCode: number | null;
  message: string;
  metadata: string;
  createdAt: string;
};
```

- [x] **Step 3: Document the concrete columns.**

Update `docs/DATA_MODEL.md` `betas and webhook_inbox` section to include the exact columns from `0004_beta_instagram.sql`, the unique `webhook_inbox.external_id`, and the rule that every Phase 5 Beta has `user_id = NULL` and `claim_status='unclaimed'`.

- [x] **Step 4: Run migration syntax smoke check.**

Run: `pnpm wrangler d1 migrations apply granite --local`

Expected: migration applies locally without SQL syntax errors. If the local D1 database is not configured, note that and run `pnpm test` after query tests are added.

- [x] **Step 5: Commit.**

```bash
git add migrations/0004_beta_instagram.sql lib/db/schema.ts docs/DATA_MODEL.md
git commit -m "feat: add beta instagram schema"
```

---

## Task 2: Beta Normalization and Caption Helpers

**Files:**
- Create: `lib/beta/normalize.ts`
- Create: `lib/beta/normalize.test.ts`
- Create: `lib/beta/caption.ts`
- Create: `lib/beta/caption.test.ts`

- [x] **Step 1: Write normalization tests.**

Create `lib/beta/normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  detectMediaPlatform,
  extractHashtags,
  normalizeHandle,
  normalizeToken,
  normalizeYouTubeOrInstagramUrl,
} from "./normalize";

describe("beta normalization", () => {
  it("normalizes hashtag tokens for route matching", () => {
    expect(normalizeToken(" Sky Hook ")).toBe("skyhook");
    expect(normalizeToken("#큰 바위")).toBe("큰바위");
    expect(normalizeToken("V5!")).toBe("v5");
  });

  it("extracts normalized hashtags from captions", () => {
    expect(extractHashtags("@granite.kr #큰바위 #SkyHook #모락산")).toEqual([
      "큰바위",
      "skyhook",
      "모락산",
    ]);
  });

  it("normalizes instagram handles without claiming ownership", () => {
    expect(normalizeHandle("@Granite.KR ")).toBe("granite.kr");
    expect(normalizeHandle("")).toBe("");
  });

  it("accepts instagram and youtube URLs only", () => {
    expect(detectMediaPlatform("https://www.instagram.com/reel/abc/")).toBe("instagram");
    expect(detectMediaPlatform("https://youtu.be/abc")).toBe("youtube");
    expect(() => detectMediaPlatform("https://example.com/video")).toThrow("Unsupported media URL");
  });

  it("returns canonical URL strings", () => {
    expect(normalizeYouTubeOrInstagramUrl("https://www.youtube.com/watch?v=abc&feature=share")).toBe(
      "https://www.youtube.com/watch?v=abc&feature=share"
    );
  });
});
```

- [x] **Step 2: Implement normalization helpers.**

Create `lib/beta/normalize.ts`:

```ts
import type { BetaPlatform } from "@/lib/db/schema";

const SUPPORTED_HOSTS: Array<{ host: string; platform: BetaPlatform }> = [
  { host: "instagram.com", platform: "instagram" },
  { host: "www.instagram.com", platform: "instagram" },
  { host: "youtube.com", platform: "youtube" },
  { host: "www.youtube.com", platform: "youtube" },
  { host: "youtu.be", platform: "youtube" },
];

export function normalizeToken(value: string): string {
  return value
    .trim()
    .replace(/^#/, "")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}._-]/gu, "")
    .toLowerCase();
}

export function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#[^\s#]+/gu) ?? [];
  return matches.map(normalizeToken).filter(Boolean);
}

export function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function detectMediaPlatform(rawUrl: string): BetaPlatform {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid media URL");
  }

  const match = SUPPORTED_HOSTS.find((entry) => entry.host === url.hostname.toLowerCase());
  if (!match) {
    throw new Error("Unsupported media URL");
  }
  return match.platform;
}

export function normalizeYouTubeOrInstagramUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  detectMediaPlatform(url.toString());
  url.hash = "";
  return url.toString();
}
```

- [x] **Step 3: Write caption tests.**

Create `lib/beta/caption.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildInstagramCaption } from "./caption";

describe("buildInstagramCaption", () => {
  it("generates the Phase 5 route caption with boulder and route hashtags", () => {
    const caption = buildInstagramCaption({
      cragName: "모락산",
      sectorName: "계원예대",
      boulderName: "큰바위",
      routeName: "Sky Hook",
      grade: "V5",
      boulderHashtags: ["모락산", "슬랩"],
    });

    expect(caption).toContain("[모락산] 계원예대 / 큰바위 / Sky Hook (V5)");
    expect(caption).toContain("@granite.kr #큰바위 #SkyHook #모락산 #슬랩");
  });
});
```

- [x] **Step 4: Implement caption generation.**

Create `lib/beta/caption.ts`:

```ts
function hashtag(value: string): string {
  return `#${value.replace(/\s+/g, "")}`;
}

export type CaptionRouteContext = {
  cragName: string;
  sectorName: string;
  boulderName: string;
  routeName: string;
  grade: string;
  boulderHashtags: string[];
};

export function buildInstagramCaption(input: CaptionRouteContext): string {
  const tags = [
    hashtag(input.boulderName),
    hashtag(input.routeName),
    ...input.boulderHashtags.map(hashtag),
  ];

  return [
    "방금 보냈어요!",
    `[${input.cragName}] ${input.sectorName} / ${input.boulderName} / ${input.routeName} (${input.grade})`,
    "",
    `@granite.kr ${Array.from(new Set(tags)).join(" ")}`,
  ].join("\n");
}
```

- [x] **Step 5: Verify.**

Run: `pnpm test lib/beta/normalize.test.ts lib/beta/caption.test.ts`

Expected: all tests pass.

- [x] **Step 6: Commit.**

```bash
git add lib/beta/normalize.ts lib/beta/normalize.test.ts lib/beta/caption.ts lib/beta/caption.test.ts
git commit -m "feat: add beta caption helpers"
```

---

## Task 3: D1 Beta Query Layer

**Files:**
- Create: `lib/db/beta-queries.ts`
- Create: `lib/db/beta-queries.test.ts`
- Modify: `lib/db/repository.ts`

- [x] **Step 1: Write query tests with mocked D1 helpers.**

Create `lib/db/beta-queries.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./d1-http", () => ({
  queryD1: vi.fn(),
  queryD1First: vi.fn(),
}));

const { queryD1, queryD1First } = await import("./d1-http");
const {
  createManualBeta,
  findPublishedRouteMatchCandidates,
  getAdminBetas,
  insertWebhookInbox,
  markWebhookRejected,
} = await import("./beta-queries");

describe("beta queries", () => {
  beforeEach(() => {
    vi.mocked(queryD1).mockReset();
    vi.mocked(queryD1First).mockReset();
  });

  it("creates manual unclaimed beta rows", async () => {
    vi.mocked(queryD1).mockResolvedValue([]);
    await createManualBeta({
      id: "beta_1",
      routeId: "route_1",
      instagramId: "climber",
      displayName: "Climber",
      platform: "instagram",
      mediaUrl: "https://www.instagram.com/p/abc/",
      permalinkUrl: "https://www.instagram.com/p/abc/",
      externalMediaId: null,
      sentAt: "2026-06-02",
    });

    expect(queryD1).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO betas"),
      expect.arrayContaining(["beta_1", "route_1", "climber", "Climber", "instagram"])
    );
  });

  it("maps admin beta rows", async () => {
    vi.mocked(queryD1).mockResolvedValue([
      {
        id: "beta_1",
        routeId: "route_1",
        routeName: "Sky Hook",
        boulderName: "큰바위",
        cragName: "모락산",
        userId: null,
        instagramId: "climber",
        displayName: "Climber",
        source: "manual",
        platform: "instagram",
        mediaUrl: "https://www.instagram.com/p/abc/",
        permalinkUrl: "https://www.instagram.com/p/abc/",
        externalMediaId: null,
        thumbnailUrl: null,
        sentAt: "2026-06-02",
        status: "pending",
        claimStatus: "unclaimed",
        createdAt: "2026-06-02 00:00:00",
        updatedAt: "2026-06-02 00:00:00",
        deletedAt: null,
      },
    ]);

    await expect(getAdminBetas({ status: "pending" })).resolves.toHaveLength(1);
  });

  it("inserts webhook inbox idempotency rows", async () => {
    vi.mocked(queryD1).mockResolvedValue([]);
    await insertWebhookInbox({
      id: "webhook_1",
      externalId: "ig_media_1",
      igUserId: "ig_user_1",
      igUsername: "climber",
      caption: "@granite.kr #큰바위 #SkyHook",
      mediaUrl: "https://www.instagram.com/p/abc/",
      thumbnailUrl: null,
      rawPayload: "{}",
    });

    expect(queryD1).toHaveBeenCalledWith(expect.stringContaining("INSERT OR IGNORE INTO webhook_inbox"), expect.any(Array));
  });

  it("queries published route candidates for matching", async () => {
    vi.mocked(queryD1).mockResolvedValue([]);
    await findPublishedRouteMatchCandidates();
    expect(queryD1).toHaveBeenCalledWith(expect.stringContaining("FROM routes r"), []);
  });

  it("marks webhook entries rejected", async () => {
    vi.mocked(queryD1).mockResolvedValue([]);
    await markWebhookRejected("webhook_1");
    expect(queryD1).toHaveBeenCalledWith(expect.stringContaining("status = 'rejected'"), ["webhook_1"]);
  });
});
```

- [x] **Step 2: Implement Beta query functions.**

Create `lib/db/beta-queries.ts` with these exported functions:

```ts
import { queryD1 } from "./d1-http";
import type { BetaPlatform, BetaStatus, WebhookInboxStatus } from "./schema";

export type CreateManualBetaInput = {
  id: string;
  routeId: string;
  instagramId: string;
  displayName: string;
  platform: BetaPlatform;
  mediaUrl: string;
  permalinkUrl: string | null;
  externalMediaId: string | null;
  sentAt: string;
};

export type RouteMatchCandidate = {
  routeId: string;
  routeName: string;
  boulderName: string;
  boulderHashtags: string;
};

export type AdminBetaRow = CreateManualBetaInput & {
  routeName: string;
  boulderName: string;
  cragName: string;
  userId: string | null;
  source: "manual" | "instagram_webhook";
  thumbnailUrl: string | null;
  status: BetaStatus;
  claimStatus: "unclaimed" | "claimed" | "verified" | "revoked";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type WebhookInboxAdminRow = {
  id: string;
  externalId: string;
  igUsername: string;
  caption: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  matchedBetaId: string | null;
  status: WebhookInboxStatus;
  receivedAt: string;
  updatedAt: string;
};

export async function createManualBeta(input: CreateManualBetaInput): Promise<void> {
  await queryD1(
    `INSERT INTO betas (
       id, route_id, user_id, instagram_id, display_name, source, platform,
       media_url, permalink_url, external_media_id, thumbnail_url, sent_at, status, claim_status
     ) VALUES (?, ?, NULL, ?, ?, 'manual', ?, ?, ?, ?, NULL, ?, 'pending', 'unclaimed')`,
    [
      input.id,
      input.routeId,
      input.instagramId,
      input.displayName,
      input.platform,
      input.mediaUrl,
      input.permalinkUrl,
      input.externalMediaId,
      input.sentAt,
    ]
  );
}

export async function findPublishedRouteMatchCandidates(): Promise<RouteMatchCandidate[]> {
  return queryD1<RouteMatchCandidate>(
    `SELECT
       r.id AS routeId,
       r.name AS routeName,
       b.name AS boulderName,
       b.hashtags AS boulderHashtags
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE r.is_published = 1
       AND t.is_published = 1
       AND b.is_published = 1
       AND s.is_published = 1
       AND c.is_published = 1
       AND a.is_published = 1
       AND r.deleted_at IS NULL
       AND t.deleted_at IS NULL
       AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND a.deleted_at IS NULL`,
    []
  );
}

export async function getAdminBetas(filters: { status?: BetaStatus } = {}): Promise<AdminBetaRow[]> {
  const where = filters.status ? "WHERE be.status = ?" : "";
  const params = filters.status ? [filters.status] : [];
  return queryD1<AdminBetaRow>(
    `SELECT
       be.id,
       be.route_id AS routeId,
       r.name AS routeName,
       b.name AS boulderName,
       c.name AS cragName,
       be.user_id AS userId,
       be.instagram_id AS instagramId,
       be.display_name AS displayName,
       be.source,
       be.platform,
       be.media_url AS mediaUrl,
       be.permalink_url AS permalinkUrl,
       be.external_media_id AS externalMediaId,
       be.thumbnail_url AS thumbnailUrl,
       be.sent_at AS sentAt,
       be.status,
       be.claim_status AS claimStatus,
       be.created_at AS createdAt,
       be.updated_at AS updatedAt,
       be.deleted_at AS deletedAt
     FROM betas be
     JOIN routes r ON r.id = be.route_id
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     ${where}
     ORDER BY be.created_at DESC`,
    params
  );
}

export async function insertWebhookInbox(input: {
  id: string;
  externalId: string;
  igUserId: string;
  igUsername: string;
  caption: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  rawPayload: string;
}): Promise<void> {
  await queryD1(
    `INSERT OR IGNORE INTO webhook_inbox (
       id, provider, external_id, ig_user_id, ig_username, caption,
       media_url, thumbnail_url, matched_beta_id, status, raw_payload
     ) VALUES (?, 'instagram', ?, ?, ?, ?, ?, ?, NULL, 'received', ?)`,
    [
      input.id,
      input.externalId,
      input.igUserId,
      input.igUsername,
      input.caption,
      input.mediaUrl,
      input.thumbnailUrl,
      input.rawPayload,
    ]
  );
}

export async function getAdminWebhookInbox(status: WebhookInboxStatus = "unmatched"): Promise<WebhookInboxAdminRow[]> {
  return queryD1<WebhookInboxAdminRow>(
    `SELECT
       id,
       external_id AS externalId,
       ig_username AS igUsername,
       caption,
       media_url AS mediaUrl,
       thumbnail_url AS thumbnailUrl,
       matched_beta_id AS matchedBetaId,
       status,
       received_at AS receivedAt,
       updated_at AS updatedAt
     FROM webhook_inbox
     WHERE status = ?
     ORDER BY received_at DESC`,
    [status]
  );
}

export async function updateBetaStatus(id: string, status: BetaStatus): Promise<void> {
  await queryD1(`UPDATE betas SET status = ?, updated_at = datetime('now') WHERE id = ?`, [status, id]);
}

export async function markWebhookRejected(id: string): Promise<void> {
  await queryD1(`UPDATE webhook_inbox SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`, [id]);
}

export async function getApprovedBetaVideosByRoute(routeId: string): Promise<Array<{
  id: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  displayName: string;
}>> {
  return queryD1(
    `SELECT
       id,
       COALESCE(permalink_url, media_url) AS mediaUrl,
       thumbnail_url AS thumbnailUrl,
       display_name AS displayName
     FROM betas
     WHERE route_id = ?
       AND status = 'approved'
       AND deleted_at IS NULL
     ORDER BY sent_at DESC, created_at DESC`,
    [routeId]
  );
}
```

- [x] **Step 3: Add repository helper for route caption context.**

Modify `lib/db/repository.ts` to expose `findRouteCaptionContext(routeId: string)` that joins route → topo → boulder → sector → crag and returns names, grade, and parsed boulder hashtags. Use the same published/deleted ancestor gates used by existing public route queries.

- [x] **Step 4: Add duplicate handling query helpers.**

In `lib/db/beta-queries.ts`, add:
- `findExistingBetaByExternalMedia(platform, externalMediaId)` for webhook and hashtag flows.
- `findExistingBetaByPermalink(platform, permalinkUrl)` for manual URL and hashtag flows.
- `markWebhookDuplicate(webhookId, matchedBetaId)` to set `webhook_inbox.status='duplicate'`, `matched_beta_id`, and an operational error code like `duplicate_beta`.
- `insertWebhookOperationalEvent(input)` to insert rows into `webhook_operational_events` for invalid signatures, Graph API failures, duplicate drops, ambiguous matches, and thumbnail failures.
- `getRecentWebhookOperationalEvents(limit)` to power the admin operations panel.

Expected duplicate behavior:
- Manual URL submission with an existing `platform + permalink_url` must not create a new Beta. `submitManualBetaAction` returns `{ ok: false, message: "이미 등록된 영상입니다." }` and the UI shows that message in the manual form.
- Webhook retry with an existing `platform + external_media_id` must mark the inbox row `duplicate` and point to the existing Beta.
- Admin manual match must refuse to create a duplicate and show the existing Beta id in `/admin/webhooks`.

- [x] **Step 5: Verify.**

Run: `pnpm test lib/db/beta-queries.test.ts`

Expected: all tests pass.

- [x] **Step 6: Commit.**

```bash
git add lib/db/beta-queries.ts lib/db/beta-queries.test.ts lib/db/repository.ts
git commit -m "feat: add beta query layer"
```

---

## Task 4: Manual Beta Server Action

**Files:**
- Create: `lib/actions/beta-schema.ts`
- Create: `lib/actions/beta.ts`
- Create: `lib/actions/beta.test.ts`

- [x] **Step 1: Write action tests.**

Create `lib/actions/beta.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:crypto", () => ({ randomUUID: () => "uuid-1" }));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/db/beta-queries", () => ({
  createManualBeta: vi.fn(),
  findExistingBetaByPermalink: vi.fn(),
}));

const { createManualBeta, findExistingBetaByPermalink } = await import("@/lib/db/beta-queries");
const { submitManualBetaAction } = await import("./beta");

describe("submitManualBetaAction", () => {
  beforeEach(() => {
    vi.mocked(createManualBeta).mockReset();
    vi.mocked(findExistingBetaByPermalink).mockReset();
    vi.mocked(findExistingBetaByPermalink).mockResolvedValue(null);
  });

  it("creates a pending manual instagram beta", async () => {
    const form = new FormData();
    form.set("routeId", "route_1");
    form.set("mediaUrl", "https://www.instagram.com/p/abc/");
    form.set("displayName", "Climber");
    form.set("instagramId", "@climber");
    form.set("sentAt", "2026-06-02");

    await expect(submitManualBetaAction(form)).resolves.toEqual({
      ok: true,
      message: "베타 영상이 등록되었습니다.",
    });

    expect(createManualBeta).toHaveBeenCalledWith({
      id: "beta_uuid-1",
      routeId: "route_1",
      instagramId: "climber",
      displayName: "Climber",
      platform: "instagram",
      mediaUrl: "https://www.instagram.com/p/abc/",
      permalinkUrl: "https://www.instagram.com/p/abc/",
      externalMediaId: null,
      sentAt: "2026-06-02",
    });
  });

  it("rejects unsupported URLs", async () => {
    const form = new FormData();
    form.set("routeId", "route_1");
    form.set("mediaUrl", "https://example.com/video");
    form.set("displayName", "Climber");
    form.set("instagramId", "climber");
    form.set("sentAt", "2026-06-02");

    await expect(submitManualBetaAction(form)).rejects.toThrow("Unsupported media URL");
  });

  it("returns duplicate message without creating a new beta", async () => {
    vi.mocked(findExistingBetaByPermalink).mockResolvedValue({ id: "beta_existing" });
    const form = new FormData();
    form.set("routeId", "route_1");
    form.set("mediaUrl", "https://www.instagram.com/p/abc/");
    form.set("displayName", "Climber");
    form.set("instagramId", "@climber");
    form.set("sentAt", "2026-06-02");

    await expect(submitManualBetaAction(form)).resolves.toEqual({
      ok: false,
      message: "이미 등록된 영상입니다.",
    });
    expect(createManualBeta).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Implement Zod parser.**

Create `lib/actions/beta-schema.ts`:

```ts
import { z } from "zod";
import {
  detectMediaPlatform,
  normalizeHandle,
  normalizeYouTubeOrInstagramUrl,
} from "@/lib/beta/normalize";

const manualBetaSchema = z.object({
  routeId: z.string().min(1),
  mediaUrl: z.string().url(),
  displayName: z.string().trim().min(1).max(40),
  instagramId: z.string().trim().max(40).default(""),
  sentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function parseManualBetaForm(raw: Record<string, FormDataEntryValue>) {
  const parsed = manualBetaSchema.parse(raw);
  const mediaUrl = normalizeYouTubeOrInstagramUrl(parsed.mediaUrl);
  return {
    routeId: parsed.routeId,
    mediaUrl,
    permalinkUrl: mediaUrl,
    externalMediaId: null,
    displayName: parsed.displayName.trim(),
    instagramId: normalizeHandle(parsed.instagramId),
    platform: detectMediaPlatform(mediaUrl),
    sentAt: parsed.sentAt,
  };
}
```

- [x] **Step 3: Implement Server Action.**

Create `lib/actions/beta.ts`:

```ts
"use server";

import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import { createManualBeta, findExistingBetaByPermalink } from "@/lib/db/beta-queries";
import { parseManualBetaForm } from "./beta-schema";

export type ManualBetaActionResult = {
  ok: boolean;
  message: string;
};

export async function submitManualBetaAction(formData: FormData): Promise<ManualBetaActionResult> {
  const parsed = parseManualBetaForm(Object.fromEntries(formData));
  const existing = await findExistingBetaByPermalink(parsed.platform, parsed.permalinkUrl);
  if (existing) {
    return { ok: false, message: "이미 등록된 영상입니다." };
  }

  await createManualBeta({
    id: `beta_${randomUUID()}`,
    routeId: parsed.routeId,
    instagramId: parsed.instagramId,
    displayName: parsed.displayName,
    platform: parsed.platform,
    mediaUrl: parsed.mediaUrl,
    permalinkUrl: parsed.permalinkUrl,
    externalMediaId: parsed.externalMediaId,
    sentAt: parsed.sentAt,
  });

  revalidateTag(`route:${parsed.routeId}`);
  return { ok: true, message: "베타 영상이 등록되었습니다." };
}
```

- [x] **Step 4: Verify.**

Run: `pnpm test lib/actions/beta.test.ts`

Expected: all tests pass.

- [x] **Step 5: Commit.**

```bash
git add lib/actions/beta-schema.ts lib/actions/beta.ts lib/actions/beta.test.ts
git commit -m "feat: add manual beta action"
```

---

## Task 5: Public Route Beta UI and Figma Bottom Sheet

**Files:**
- Modify: `app/(site)/t/[topoId]/page.tsx`
- Create: `components/public/beta-route-actions.tsx`
- Create: `components/public/beta-video-sheet.tsx`
- Create: `components/public/beta-video-grid.tsx`
- Create: `components/public/manual-beta-form.tsx`

**Figma reference:**
- Route beta bottom sheet: [Crag_Boulder_볼더_루트 선택_beta, node `1:1421`](https://www.figma.com/design/NICa8b5vZ1Ij8PYABEN3zk/%EA%B7%B8%EB%9D%BC%EB%82%98%EC%9D%B4%ED%8A%B8--dudco-?node-id=1-1421&t=etql6cn09V2zXEqf-4)

**Design requirements from node `1:1421`:**
- The route row `beta` pill opens an overlay, not inline buttons.
- Overlay dims the route/topo page with black `opacity: 60%`.
- Bottom sheet is white, full width of the mobile shell, top offset around `116px`, `rounded-t-[12px]`, and extends to the bottom.
- Top drag handle: centered `32px x 2px`, `#B8B8B8`, rounded.
- Header: centered `베타 동영상`, 18px medium, close icon at right.
- Divider below header.
- Body copy: 14px regular, `#2A2A2A`.
- Caption preview box: `#F7F8F8`, height `72px`, radius `10px`, contains generated caption/hashtags.
- CTA 1: full-width black pill, text `캡션 복사하고 Instagram 열기`.
- CTA 2: full-width black pill, text `베타 영상 올리기`.
- Below CTAs: approved Beta thumbnail grid, 3 columns, square cells, 120px in the 360px Figma frame, with white 1px separators.
- Do not implement Figma iPhone status bar in the real app; real app starts at the existing 56px app header/topo page header per project UI rules.

- [x] **Step 1: Add a client action component.**

Create `components/public/beta-route-actions.tsx`:

```tsx
"use client";

import { useState } from "react";
import { BetaVideoSheet } from "./beta-video-sheet";
import type { BetaVideoItem } from "./beta-video-grid";

export function BetaRouteActions({
  routeId,
  caption,
  betaVideos,
}: {
  routeId: string;
  caption: string;
  betaVideos: BetaVideoItem[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-6 w-[72px] items-center justify-center gap-1 rounded-full bg-[#E8E8E8] text-[12px] font-medium leading-4 text-[#3A3A3A]"
      >
        beta
      </button>
      {open ? (
        <BetaVideoSheet
          routeId={routeId}
          caption={caption}
          betaVideos={betaVideos}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
```

- [x] **Step 2: Add beta video thumbnail grid.**

Create `components/public/beta-video-grid.tsx`:

```tsx
export type BetaVideoItem = {
  id: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  displayName: string;
};

export function BetaVideoGrid({ items }: { items: BetaVideoItem[] }) {
  if (items.length === 0) {
    return (
      <div className="grid grid-cols-3">
        {Array.from({ length: 9 }).map((_, index) => (
          <div
            key={index}
            className="aspect-square border border-white bg-[#D9D9D9]"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3">
      {items.map((item) => (
        <a
          key={item.id}
          href={item.mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="aspect-square overflow-hidden border border-white bg-[#D9D9D9]"
          aria-label={`${item.displayName} 베타 영상 열기`}
        >
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : null}
        </a>
      ))}
    </div>
  );
}
```

- [x] **Step 3: Add Figma beta video bottom sheet.**

Create `components/public/beta-video-sheet.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { ManualBetaForm } from "./manual-beta-form";
import { BetaVideoGrid, type BetaVideoItem } from "./beta-video-grid";

export function BetaVideoSheet({
  routeId,
  caption,
  betaVideos,
  onClose,
}: {
  routeId: string;
  caption: string;
  betaVideos: BetaVideoItem[];
  onClose: () => void;
}) {
  const [showManualForm, setShowManualForm] = useState(false);
  const instagramHref = useMemo(
    () => `https://www.instagram.com/?caption=${encodeURIComponent(caption)}`,
    [caption]
  );

  async function copyAndOpenInstagram() {
    await navigator.clipboard.writeText(caption);
    window.open(instagramHref, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60">
      <section className="absolute inset-x-0 bottom-0 top-[116px] overflow-y-auto rounded-t-[12px] bg-white">
        <div className="mx-auto mt-2 h-[2px] w-8 rounded-full bg-[#B8B8B8]" />
        <header className="relative flex h-[38px] items-center justify-center border-b border-[#E8E8E8]">
          <h2 className="text-[18px] font-medium leading-6 text-[#090909]">베타 동영상</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 grid size-6 place-items-center text-[28px] leading-none text-[#121212]"
            aria-label="닫기"
          >
            ×
          </button>
        </header>
        <div className="px-4 pb-6 pt-4">
          <p className="text-[14px] font-normal leading-5 text-[#2A2A2A]">
            캡션을 복사하여 인스타그램 게시물에 넣어주면 베타 영상이 루트에 연결됩니다.
          </p>
          <div className="mt-5 rounded-[10px] bg-[#F7F8F8] px-4 py-3 text-[14px] font-normal leading-5 text-[#2A2A2A]">
            <p>캡션</p>
            <p className="line-clamp-2 whitespace-pre-wrap">{caption}</p>
          </div>
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={copyAndOpenInstagram}
              className="h-8 w-full rounded-full bg-[#1A1A1A] text-[14px] font-medium leading-5 text-white"
            >
              캡션 복사하고 Instagram 열기
            </button>
            <button
              type="button"
              onClick={() => setShowManualForm(true)}
              className="h-8 w-full rounded-full bg-[#1A1A1A] text-[14px] font-medium leading-5 text-white"
            >
              베타 영상 올리기
            </button>
          </div>
        </div>
        <BetaVideoGrid items={betaVideos} />
      </section>
      {showManualForm ? (
        <ManualBetaForm routeId={routeId} onClose={() => setShowManualForm(false)} />
      ) : null}
    </div>
  );
}
```

- [x] **Step 4: Add manual form modal.**

Create `components/public/manual-beta-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { submitManualBetaAction } from "@/lib/actions/beta";

export function ManualBetaForm({
  routeId,
  onClose,
}: {
  routeId: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(async (_state: { message: string } | null, formData: FormData) => {
    const result = await submitManualBetaAction(formData);
    if (result.ok) onClose();
    return { message: result.message };
  }, null);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40">
      <form action={formAction} className="w-full rounded-t-2xl bg-white p-4 shadow-xl">
        <input type="hidden" name="routeId" value={routeId} />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[18px] font-semibold">베타 영상 올리기</h2>
          <button type="button" onClick={onClose} className="text-[14px] text-[#7A7A7A]">
            닫기
          </button>
        </div>
        <label className="mb-3 block text-[13px] font-medium">
          영상 URL
          <input name="mediaUrl" required type="url" className="mt-1 h-11 w-full rounded-lg border border-[#DADDE1] px-3" />
        </label>
        <label className="mb-3 block text-[13px] font-medium">
          표시명
          <input name="displayName" required className="mt-1 h-11 w-full rounded-lg border border-[#DADDE1] px-3" />
        </label>
        <label className="mb-3 block text-[13px] font-medium">
          Instagram 핸들
          <input name="instagramId" className="mt-1 h-11 w-full rounded-lg border border-[#DADDE1] px-3" placeholder="@username" />
        </label>
        <label className="mb-4 block text-[13px] font-medium">
          완등 날짜
          <input name="sentAt" required type="date" className="mt-1 h-11 w-full rounded-lg border border-[#DADDE1] px-3" />
        </label>
        {state?.message ? (
          <p className="mb-3 text-[13px] leading-5 text-[#7A7A7A]">{state.message}</p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="h-12 w-full rounded-full bg-[#1A1A1A] text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {pending ? "등록 중" : "등록하기"}
        </button>
      </form>
    </div>
  );
}
```

- [x] **Step 5: Render Beta controls in Topo route rows.**

Modify `app/(site)/t/[topoId]/page.tsx`:

```tsx
import { buildInstagramCaption } from "@/lib/beta/caption";
import { getApprovedBetaVideosByRoute } from "@/lib/db/beta-queries";
import { parseHashtags } from "@/lib/db/queries";
import { BetaRouteActions } from "@/components/public/beta-route-actions";
```

Before rendering route rows in `TopoRouteSheet`, build a route id keyed map:

```tsx
const betaVideoEntries = await Promise.all(
  topo.routes.map(async (route) => [route.id, await getApprovedBetaVideosByRoute(route.id)] as const)
);
const betaVideosByRouteId = new Map(betaVideoEntries);
```

Inside each route row, compute:

```tsx
const betaVideos = betaVideosByRouteId.get(route.id) ?? [];
const caption = buildInstagramCaption({
  cragName: topo.crag.name,
  sectorName: topo.sector.name,
  boulderName: topo.boulder.name,
  routeName: route.name,
  grade: route.grade,
  boulderHashtags: parseHashtags(topo.boulder.hashtags),
});
```

Then render after the route metadata:

```tsx
<BetaRouteActions routeId={route.id} caption={caption} betaVideos={betaVideos} />
```

- [x] **Step 6: Verify.**

Run: `pnpm typecheck`

Expected: TypeScript passes.

Run: `pnpm dev`

Manual browser QA:
- Open any existing Topo detail route under `/t/`.
- Click `캡션 복사`, paste into a scratch field, and confirm `@granite.kr`, the Boulder hashtag, and the Route hashtag are present.
- Click a route row `beta` pill and confirm the Figma node `1:1421` bottom sheet appears: dim overlay, title `베타 동영상`, close icon, caption preview box, two black full-width CTAs, and 3-column square thumbnail grid.
- Click `캡션 복사하고 Instagram 열기`, confirm caption is copied and Instagram opens.
- Open `베타 영상 올리기`, submit Instagram URL, display name, handle, date.
- Confirm row appears in `/admin/betas` after Task 7.

- [x] **Step 7: Commit.**

```bash
git add 'app/(site)/t/[topoId]/page.tsx' components/public/beta-route-actions.tsx components/public/beta-video-sheet.tsx components/public/beta-video-grid.tsx components/public/manual-beta-form.tsx
git commit -m "feat: add public beta submission ui"
```

---

## Task 6: Instagram Webhook Worker

**Files:**
- Create: `workers/instagram-webhook/src/index.ts`
- Create: `workers/instagram-webhook/src/hmac.ts`
- Create: `workers/instagram-webhook/src/payload.ts`
- Create: `workers/instagram-webhook/src/match.ts`
- Create: `workers/instagram-webhook/src/d1.ts`
- Create: `workers/instagram-webhook/src/thumbnail.ts`
- Create: `workers/instagram-webhook/src/index.test.ts`
- Modify: `wrangler.toml`

- [x] **Step 1: Write Worker behavior tests.**

Create `workers/instagram-webhook/src/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { verifyMetaSignature } from "./hmac";
import { extractMentionEvents } from "./payload";

describe("instagram webhook worker", () => {
  it("verifies Meta sha256 signatures", async () => {
    const body = '{"object":"instagram"}';
    const secret = "secret";
    const signature = await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
      new TextEncoder().encode(body)
    );
    const hex = Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
    await expect(verifyMetaSignature(body, `sha256=${hex}`, secret)).resolves.toBe(true);
  });

  it("extracts mention event fields", () => {
    const events = extractMentionEvents({
      entry: [
        {
          id: "ig_user_1",
          changes: [
            {
              field: "mentions",
              value: {
                media_id: "media_1",
              },
            },
          ],
        },
      ],
    });

    expect(events).toEqual([
      {
        externalId: "media_1",
        igUserId: "ig_user_1",
        mediaId: "media_1",
        commentId: null,
      },
    ]);
  });

  it("extracts comment mention event ids", () => {
    const events = extractMentionEvents({
      entry: [
        {
          id: "ig_user_1",
          changes: [
            {
              field: "mentions",
              value: {
                media_id: "media_1",
                comment_id: "comment_1",
              },
            },
          ],
        },
      ],
    });

    expect(events[0]).toEqual({
      externalId: "comment_1",
      igUserId: "ig_user_1",
      mediaId: "media_1",
      commentId: "comment_1",
    });
  });
});
```

- [x] **Step 2: Implement HMAC helper.**

Create `workers/instagram-webhook/src/hmac.ts`:

```ts
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyMetaSignature(body: string, header: string | null, secret: string): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const expected = header.slice("sha256=".length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return toHex(digest) === expected;
}
```

- [x] **Step 3: Implement payload extraction.**

Create `workers/instagram-webhook/src/payload.ts` with a narrow parser that ignores unknown changes and returns only notification ids:
- `externalId`: `comment_id` when present, otherwise `media_id`;
- `igUserId`: `entry.id`;
- `mediaId`: `value.media_id`;
- `commentId`: `value.comment_id ?? null`.

The webhook notification does not include caption, username, media URL, thumbnail, or permalink. Those fields must be fetched in `match.ts` with Mentioned Media / Mentioned Comment API calls.

- [x] **Step 4: Implement Worker route.**

Create `workers/instagram-webhook/src/index.ts`:

```ts
import { verifyMetaSignature } from "./hmac";
import { extractMentionEvents } from "./payload";
import { processMentionEvent } from "./match";

export interface Env {
  META_APP_SECRET: string;
  META_WEBHOOK_VERIFY_TOKEN: string;
  INSTAGRAM_GRAPH_ACCESS_TOKEN: string;
  DB: D1Database;
  BETA_THUMBNAILS: R2Bucket;
  CDN_BASE_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/webhooks/instagram") return new Response("Not found", { status: 404 });

    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
        return new Response(challenge, { status: 200 });
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const body = await request.text();
    const valid = await verifyMetaSignature(body, request.headers.get("X-Hub-Signature-256"), env.META_APP_SECRET);
    if (!valid) return new Response("Invalid signature", { status: 401 });

    const payload = JSON.parse(body) as unknown;
    const events = extractMentionEvents(payload);
    await Promise.all(events.map((event) => processMentionEvent(event, env, body)));
    return new Response("OK", { status: 200 });
  },
};
```

- [x] **Step 5: Implement matching logic.**

Create `workers/instagram-webhook/src/match.ts` so `processMentionEvent`:
- inserts `webhook_inbox` using `external_id` with `INSERT OR IGNORE` and the raw notification payload;
- if `commentId` is present, calls `mentioned_comment.comment_id({commentId}){text,media}` first and uses `text` as the caption matching input;
- calls `mentioned_media.media_id({mediaId}){thumbnail_url,media_url,caption,username,media_type,permalink}` to get media metadata;
- normalizes `username` into `instagram_id`, stores `external_media_id=mediaId`, and stores `permalink_url` only when Graph API returns a real permalink;
- before inserting a Beta, calls `findExistingBetaByExternalMedia('instagram', mediaId)`;
- if an existing Beta is found, updates `webhook_inbox.status='duplicate'`, sets `matched_beta_id` to the existing Beta id, writes a `webhook_operational_events` row with `event_type='duplicate_beta'`, and stops processing;
- extracts caption hashtags with the same normalization semantics as `lib/beta/normalize.ts` or a Worker-local copy if path aliases are not configured;
- loads published route candidates;
- finds candidates where normalized Boulder name and normalized Route name are both present;
- if exactly one candidate exists, inserts `betas` with `source='instagram_webhook'`, `platform='instagram'`, `user_id=NULL`, `status='pending'`, `claim_status='unclaimed'`, `media_url=mentioned_media.media_url ?? mentioned_media.permalink ?? ''`, `permalink_url=mentioned_media.permalink ?? null`, and `external_media_id=mediaId`;
- updates `webhook_inbox.status='matched'` and `matched_beta_id`;
- if zero or many candidates exist, updates `webhook_inbox.status='unmatched'`.

- [x] **Step 6: Configure Worker.**

Modify `wrangler.toml` to preserve the existing Granite resources and align binding names with the Worker `Env` interface:

```toml
name = "granite-workers"
main = "workers/instagram-webhook/src/index.ts"
compatibility_date = "2026-06-02"

[vars]
ENVIRONMENT = "production"
CDN_BASE_URL = "https://cdn.granite.kr"

[[d1_databases]]
binding = "DB"
database_name = "granite-v2"
database_id = "086073b7-4369-47ea-baf6-2b76de860620"

[[r2_buckets]]
binding = "BETA_THUMBNAILS"
bucket_name = "granite-v2"
```

If implementation chooses to keep the current binding names `granite_v2` and `BUCKET`, update the Worker `Env` interface and all Worker code to use those exact names instead of `DB` and `BETA_THUMBNAILS`.

- [x] **Step 7: Verify.**

Run: `pnpm test workers/instagram-webhook/src/index.test.ts`

Expected: all tests pass.

Run: `pnpm wrangler deploy --dry-run`

Expected: Worker bundles without type or binding errors.

- [x] **Step 8: Commit.**

```bash
git add workers/instagram-webhook wrangler.toml
git commit -m "feat: add instagram webhook worker"
```

---

## Task 7: Admin Beta Moderation

**Files:**
- Create: `lib/actions/admin-beta.ts`
- Create: `lib/actions/admin-beta.test.ts`
- Create: `app/admin/(protected)/betas/page.tsx`
- Modify: `components/admin/admin-shell.tsx`

- [x] **Step 1: Write admin action tests.**

Create `lib/actions/admin-beta.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/admin", () => ({ requireAdmin: vi.fn().mockResolvedValue({ adminId: "admin_1" }) }));
vi.mock("@/lib/db/admin-queries", () => ({ insertAdminAuditLog: vi.fn() }));
vi.mock("@/lib/db/beta-queries", () => ({ updateBetaStatus: vi.fn() }));

const { updateBetaStatus } = await import("@/lib/db/beta-queries");
const { setBetaStatusAction } = await import("./admin-beta");

describe("admin beta actions", () => {
  beforeEach(() => vi.mocked(updateBetaStatus).mockReset());

  it("updates beta moderation status", async () => {
    const form = new FormData();
    form.set("id", "beta_1");
    form.set("status", "approved");
    await setBetaStatusAction(form);
    expect(updateBetaStatus).toHaveBeenCalledWith("beta_1", "approved");
  });
});
```

- [x] **Step 2: Implement admin action.**

Create `lib/actions/admin-beta.ts`:

```ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { insertAdminAuditLog } from "@/lib/db/admin-queries";
import { markWebhookRejected, updateBetaStatus } from "@/lib/db/beta-queries";

const betaStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["pending", "approved", "hidden", "removed"]),
});

export async function setBetaStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = betaStatusSchema.parse(Object.fromEntries(formData));
  await updateBetaStatus(parsed.id, parsed.status);
  await insertAdminAuditLog({
    adminId: admin.adminId,
    action: "beta.status",
    targetType: "beta",
    targetId: parsed.id,
    metadata: { status: parsed.status },
  });
  revalidatePath("/admin/betas");
  revalidateTag(`beta:${parsed.id}`);
}

export async function rejectWebhookAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  await markWebhookRejected(id);
  await insertAdminAuditLog({
    adminId: admin.adminId,
    action: "webhook.reject",
    targetType: "webhook_inbox",
    targetId: id,
    metadata: {},
  });
  revalidatePath("/admin/webhooks");
}
```

- [x] **Step 3: Add admin Beta page.**

Create `app/admin/(protected)/betas/page.tsx` with:
- `getAdminBetas({ status })`;
- status filter links for `pending`, `approved`, `hidden`, `removed`;
- columns: Route, Boulder/Crag, source/platform, Instagram handle/display name, media URL, sent date, status, actions;
- action forms calling `setBetaStatusAction` for approve/hide/remove.

- [x] **Step 4: Add admin nav.**

Modify `components/admin/admin-shell.tsx` to include:

```tsx
{ href: "/admin/betas", label: "Betas" },
{ href: "/admin/webhooks", label: "Webhooks" },
```

Use the existing nav data structure in that file.

- [x] **Step 5: Verify.**

Run: `pnpm test lib/actions/admin-beta.test.ts`

Expected: all tests pass.

Run: `pnpm typecheck`

Expected: TypeScript passes.

- [x] **Step 6: Commit.**

```bash
git add lib/actions/admin-beta.ts lib/actions/admin-beta.test.ts 'app/admin/(protected)/betas/page.tsx' components/admin/admin-shell.tsx
git commit -m "feat: add beta moderation admin"
```

---

## Task 8: Admin Webhook Inbox

**Files:**
- Modify: `lib/db/beta-queries.ts`
- Modify: `lib/actions/admin-beta.ts`
- Create: `app/admin/(protected)/webhooks/page.tsx`

- [x] **Step 1: Add manual match query function.**

In `lib/db/beta-queries.ts`, add `manualMatchWebhookToRoute(input)` that:
- loads the webhook row by id;
- creates a `betas` row with `source='instagram_webhook'`, `platform='instagram'`, `user_id=NULL`, `status='pending'`, `claim_status='unclaimed'`;
- updates `webhook_inbox.status='manual_matched'` and `matched_beta_id`.

- [x] **Step 2: Add manual match Server Action.**

In `lib/actions/admin-beta.ts`, add:

```ts
const manualMatchSchema = z.object({
  webhookId: z.string().min(1),
  routeId: z.string().min(1),
});

export async function manualMatchWebhookAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = manualMatchSchema.parse(Object.fromEntries(formData));
  await manualMatchWebhookToRoute({
    webhookId: parsed.webhookId,
    routeId: parsed.routeId,
    betaId: `beta_${randomUUID()}`,
  });
  await insertAdminAuditLog({
    adminId: admin.adminId,
    action: "webhook.manual_match",
    targetType: "webhook_inbox",
    targetId: parsed.webhookId,
    metadata: { routeId: parsed.routeId },
  });
  revalidatePath("/admin/webhooks");
  revalidatePath("/admin/betas");
}
```

Import `randomUUID` from `node:crypto` and `manualMatchWebhookToRoute` from `@/lib/db/beta-queries`.

- [x] **Step 3: Add webhook inbox page.**

Create `app/admin/(protected)/webhooks/page.tsx` with:
- `getAdminWebhookInbox(status)`;
- route options from existing admin route read query;
- status filter links for `unmatched`, `rejected`, `manual_matched`, `matched`;
- row display of username, caption, media URL, thumbnail, received date;
- route picker form calling `manualMatchWebhookAction`;
- reject form calling `rejectWebhookAction`.

- [x] **Step 4: Verify ambiguous route workflow.**

Run: `pnpm typecheck`

Manual QA:
- Seed or insert a `webhook_inbox` row with `status='unmatched'`.
- Open `/admin/webhooks`.
- Select a Route and submit manual match.
- Confirm `/admin/betas` has a pending Beta and the inbox row moved to `manual_matched`.
- Reject another row and confirm status `rejected`.

- [x] **Step 5: Commit.**

```bash
git add lib/db/beta-queries.ts lib/actions/admin-beta.ts 'app/admin/(protected)/webhooks/page.tsx'
git commit -m "feat: add webhook inbox moderation"
```

---

## Task 9: Durable Thumbnail Acquisition and R2 Copy

**Files:**
- Create: `lib/beta/thumbnail.ts`
- Create: `lib/beta/thumbnail.test.ts`
- Create: `lib/beta/instagram-oembed.ts`
- Create: `lib/beta/instagram-html.ts`
- Modify: `lib/db/beta-queries.ts`
- Modify: `workers/instagram-webhook/src/thumbnail.ts`
- Modify: `workers/instagram-webhook/src/match.ts`
- Modify: `lib/actions/beta.ts`

**Hard rule:**
- Never persist Instagram CDN thumbnail URLs as the final `betas.thumbnail_url`.
- All thumbnail source URLs from oEmbed, HTML metadata, `top_media`, or `mentioned_media` must be downloaded immediately and uploaded to R2.
- Store only the Granite CDN URL (`${CDN_BASE_URL}/betas/{betaId}/thumb-{uuid}.{ext}`) in `betas.thumbnail_url`.
- If source lookup, download, image validation, or R2 upload fails, keep the Beta row and leave `thumbnail_url = NULL`.

- [x] **Step 1: Write thumbnail tests.**

Create `lib/beta/thumbnail.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  extractInstagramHtmlThumbnailUrl,
  extractYouTubeThumbnailUrl,
  inferImageExtensionFromContentType,
} from "./thumbnail";

describe("thumbnail helpers", () => {
  it("extracts youtu.be thumbnail URL", () => {
    expect(extractYouTubeThumbnailUrl("https://youtu.be/abc123")).toBe("https://img.youtube.com/vi/abc123/hqdefault.jpg");
  });

  it("extracts youtube watch thumbnail URL", () => {
    expect(extractYouTubeThumbnailUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://img.youtube.com/vi/abc123/hqdefault.jpg"
    );
  });

  it("returns null for instagram because oEmbed fetch is required", () => {
    expect(extractYouTubeThumbnailUrl("https://www.instagram.com/p/abc/")).toBeNull();
  });

  it("extracts instagram HTML og:image fallback", () => {
    const html = '<html><head><meta property="og:image" content="https://instagram-cdn.example/thumb.jpg"></head></html>';
    expect(extractInstagramHtmlThumbnailUrl(html)).toBe("https://instagram-cdn.example/thumb.jpg");
  });

  it("extracts instagram HTML twitter:image fallback", () => {
    const html = '<meta name="twitter:image" content="https://instagram-cdn.example/twitter.jpg">';
    expect(extractInstagramHtmlThumbnailUrl(html)).toBe("https://instagram-cdn.example/twitter.jpg");
  });

  it("infers safe image extensions", () => {
    expect(inferImageExtensionFromContentType("image/jpeg")).toBe("jpg");
    expect(inferImageExtensionFromContentType("image/png")).toBe("png");
    expect(inferImageExtensionFromContentType("text/html")).toBeNull();
  });
});
```

- [x] **Step 2: Implement helper.**

Create `lib/beta/thumbnail.ts`:

```ts
export function extractYouTubeThumbnailUrl(mediaUrl: string): string | null {
  const url = new URL(mediaUrl);
  const host = url.hostname.toLowerCase();
  const id = host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v");
  if (!id || (!host.endsWith("youtube.com") && host !== "youtu.be")) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export function extractInstagramHtmlThumbnailUrl(html: string): string | null {
  const metaPatterns = [
    /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i,
    /<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["'][^>]*>/i,
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].replace(/&amp;/g, "&");
  }

  const jsonLdMatch = html.match(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
  if (jsonLdMatch?.[1]) {
    try {
      const parsed = JSON.parse(jsonLdMatch[1]) as { image?: unknown };
      if (typeof parsed.image === "string") return parsed.image;
      if (Array.isArray(parsed.image) && typeof parsed.image[0] === "string") return parsed.image[0];
    } catch {
      return null;
    }
  }

  return null;
}

export function inferImageExtensionFromContentType(contentType: string | null): "jpg" | "png" | "webp" | "gif" | null {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  return null;
}
```

- [x] **Step 3: Add Instagram oEmbed then HTML fallback lookup for manual URL input.**

Create `lib/beta/instagram-oembed.ts`:

```ts
export type InstagramOEmbedResult = {
  thumbnailUrl: string | null;
  authorName: string | null;
};

export async function fetchInstagramOEmbed(input: {
  postUrl: string;
  appId: string;
  appSecret: string;
}): Promise<InstagramOEmbedResult | null> {
  const url = new URL("https://graph.facebook.com/v21.0/instagram_oembed");
  url.searchParams.set("url", input.postUrl);
  url.searchParams.set("fields", "thumbnail_url,author_name,provider_name,provider_url");
  url.searchParams.set("access_token", `${input.appId}|${input.appSecret}`);

  const response = await fetch(url);
  if (!response.ok) return null;

  const json = (await response.json()) as { thumbnail_url?: unknown; author_name?: unknown };
  return {
    thumbnailUrl: typeof json.thumbnail_url === "string" ? json.thumbnail_url : null,
    authorName: typeof json.author_name === "string" ? json.author_name : null,
  };
}
```

Create `lib/beta/instagram-html.ts`:

```ts
import { extractInstagramHtmlThumbnailUrl } from "./thumbnail";

export async function fetchInstagramHtmlThumbnail(postUrl: string): Promise<string | null> {
  const response = await fetch(postUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 GraniteBot/1.0",
    },
  });
  if (!response.ok) return null;
  const html = await response.text();
  return extractInstagramHtmlThumbnailUrl(html);
}
```

Manual URL thumbnail lookup order:
1. `fetchInstagramOEmbed()` and use `thumbnail_url` if present.
2. If oEmbed errors or returns no thumbnail, call `fetchInstagramHtmlThumbnail()` and parse HTML metadata.
3. Download the candidate URL and upload to R2.
4. Update `betas.thumbnail_url` only with the Granite CDN URL.

- [x] **Step 4: Add DB helper for durable thumbnail URL update.**

In `lib/db/beta-queries.ts`, add:

```ts
export async function updateBetaThumbnailUrl(id: string, thumbnailUrl: string): Promise<void> {
  await queryD1(
    `UPDATE betas SET thumbnail_url = ?, updated_at = datetime('now') WHERE id = ?`,
    [thumbnailUrl, id]
  );
}
```

- [x] **Step 5: Update manual Beta action to attempt durable thumbnail after row creation.**

In `lib/actions/beta.ts`, after `createManualBeta`, attempt thumbnail acquisition:
- for Instagram URL: oEmbed first, HTML metadata fallback second;
- for YouTube URL: derive `img.youtube.com` thumbnail;
- download the thumbnail candidate;
- validate content type is `image/jpeg`, `image/png`, `image/webp`, or `image/gif`;
- upload to R2 key `betas/{betaId}/thumb-{uuid}.{ext}`;
- call `updateBetaThumbnailUrl(betaId, cdnUrl)`;
- catch and log errors without throwing.

This should be implemented through small helpers rather than putting fetch/R2 logic directly in the action.

- [x] **Step 6: Wire Worker thumbnail attempt as best effort.**

In `workers/instagram-webhook/src/thumbnail.ts`, implement a function that:
- accepts a source thumbnail URL from `mentioned_media.thumbnail_url`, `mentioned_media.media_url`, or `top_media.media_url`;
- for YouTube, derives `img.youtube.com` URL;
- fetches the image;
- validates image content type;
- writes to R2 key `betas/{betaId}/thumb-{uuid}.{ext}`;
- returns `${env.CDN_BASE_URL}/betas/{betaId}/thumb-{uuid}.{ext}`;
- catches errors and returns `null`.

- [x] **Step 7: Ensure Beta creation never depends on thumbnail success.**

In `workers/instagram-webhook/src/match.ts`, create the Beta first with `thumbnail_url = NULL`; then attempt R2 thumbnail storage and update the Beta only if a Granite CDN URL is returned. Do not store `mentioned_media.thumbnail_url`, `mentioned_media.media_url`, `top_media.media_url`, or oEmbed `thumbnail_url` directly in `betas.thumbnail_url`.

- [x] **Step 8: Verify.**

Run: `pnpm test lib/beta/thumbnail.test.ts`

Expected: tests pass.

Run: `pnpm test workers/instagram-webhook/src/index.test.ts`

Expected: tests pass.

- [x] **Step 9: Commit.**

```bash
git add lib/beta/thumbnail.ts lib/beta/thumbnail.test.ts lib/beta/instagram-oembed.ts lib/beta/instagram-html.ts lib/db/beta-queries.ts lib/actions/beta.ts workers/instagram-webhook/src/thumbnail.ts workers/instagram-webhook/src/match.ts
git commit -m "feat: add beta thumbnail fallback"
```

---

## Task 10: Security and Operations Visibility

**Files:**
- Create: `lib/beta/fetch-guard.ts`
- Create: `lib/beta/fetch-guard.test.ts`
- Modify: `lib/beta/instagram-html.ts`
- Modify: `lib/beta/thumbnail.ts`
- Modify: `workers/instagram-webhook/src/match.ts`
- Modify: `workers/instagram-webhook/src/thumbnail.ts`
- Modify: `lib/db/beta-queries.ts`
- Modify: `app/admin/(protected)/webhooks/page.tsx`
- Modify: `app/admin/(protected)/betas/page.tsx`

- [x] **Step 1: Add SSRF and external fetch guard tests.**

Create `lib/beta/fetch-guard.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { assertAllowedExternalFetchUrl, isAllowedImageContentType } from "./fetch-guard";

describe("external fetch guard", () => {
  it("allows expected instagram and youtube hosts", () => {
    expect(() => assertAllowedExternalFetchUrl("https://www.instagram.com/p/abc/", "page")).not.toThrow();
    expect(() => assertAllowedExternalFetchUrl("https://img.youtube.com/vi/abc/hqdefault.jpg", "image")).not.toThrow();
    expect(() => assertAllowedExternalFetchUrl("https://scontent-icn1-1.cdninstagram.com/v/t51/thumb.jpg", "image")).not.toThrow();
  });

  it("rejects private and unsupported hosts", () => {
    expect(() => assertAllowedExternalFetchUrl("http://127.0.0.1/admin", "page")).toThrow("Unsupported external fetch protocol");
    expect(() => assertAllowedExternalFetchUrl("https://example.com/image.jpg", "image")).toThrow("Unsupported external fetch host");
  });

  it("allows only image content types for thumbnail storage", () => {
    expect(isAllowedImageContentType("image/jpeg")).toBe(true);
    expect(isAllowedImageContentType("text/html")).toBe(false);
  });
});
```

- [x] **Step 2: Implement guarded fetch policy.**

Create `lib/beta/fetch-guard.ts`:

```ts
const ALLOWED_PAGE_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "img.youtube.com",
]);

const ALLOWED_IMAGE_HOSTS = new Set(["img.youtube.com"]);
const ALLOWED_IMAGE_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];

export function assertAllowedExternalFetchUrl(rawUrl: string, purpose: "page" | "image" = "page"): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Unsupported external fetch protocol");
  const host = url.hostname.toLowerCase();
  const allowed =
    purpose === "page"
      ? ALLOWED_PAGE_HOSTS.has(host)
      : ALLOWED_IMAGE_HOSTS.has(host) || ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  if (!allowed) {
    throw new Error("Unsupported external fetch host");
  }
  return url;
}

export function isAllowedImageContentType(contentType: string | null): boolean {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  return normalized === "image/jpeg" || normalized === "image/png" || normalized === "image/webp" || normalized === "image/gif";
}
```

Every external fetch helper must:
- call `assertAllowedExternalFetchUrl(url, "page")` before fetching Instagram/YouTube pages;
- call `assertAllowedExternalFetchUrl(url, "image")` before fetching thumbnail image candidates;
- use `redirect: "manual"` or follow at most one redirect after validating the redirect target;
- set a timeout through `AbortSignal.timeout(5000)`;
- reject responses larger than 5 MB before R2 upload;
- require an allowed image content type before R2 storage.

- [x] **Step 3: Add webhook operational state transitions.**

In `workers/instagram-webhook/src/match.ts`:
- set `webhook_inbox.status='processing'` and increment `processing_attempts` before follow-up Graph API calls;
- on Graph API transient failure, set `status='failed'`, `last_error_code='graph_api_failure'`, `last_error_message`. **No automatic retry is scheduled in Phase 5** (see Out Of Scope). The failed row stays visible in `/admin/webhooks` for operator awareness; re-delivery is handled out-of-band (Meta App Dashboard redelivery) or via manual Beta submission.
- on thumbnail copy failure after Beta creation, keep matched/manual status but set `last_error_code='thumbnail_copy_failed'` and `last_error_message`;
- on duplicate Beta, set `status='duplicate'`, `matched_beta_id=<existingBetaId>`, `last_error_code='duplicate_beta'`;
- on invalid signature, do not insert `webhook_inbox` and do not store the raw body. Insert a `webhook_operational_events` row with `event_type='invalid_signature'`, method/path/status code/request id, then return `401`.
- for every `last_error_code` written on `webhook_inbox`, also insert a corresponding `webhook_operational_events` row so `/admin/webhooks` can show both current row state and recent operational events.

- [x] **Step 4: Add admin operations columns and filters.**

Update `/admin/webhooks` to show:
- status badge for `received`, `processing`, `matched`, `unmatched`, `manual_matched`, `rejected`, `duplicate`, `failed`;
- `processing_attempts`;
- `last_error_code`;
- truncated `last_error_message`;
- actions: manual match unmatched item, reject unmatched/failed item.
- a recent operational events panel from `webhook_operational_events`, including `invalid_signature` rows that have no `webhook_id`;

No automatic or admin-triggered "retry" action in Phase 5 (see Out Of Scope). Operators handle `failed` rows by either redelivering from Meta App Dashboard, dropping the row via reject, or re-creating the Beta through the manual submission form.

Update `/admin/betas` to show:
- source/platform;
- duplicate key fields (`external_media_id`, `permalink_url`);
- thumbnail status: `R2 stored` or `missing`;
- moderation note field;
- public visibility rule: only `approved` is public.

- [x] **Step 5: Verify.**

Run:

```bash
pnpm test lib/beta/fetch-guard.test.ts
pnpm test lib/beta/thumbnail.test.ts
pnpm test workers/instagram-webhook/src/index.test.ts
pnpm typecheck
```

Manual QA:
- unsupported manual URL host is rejected before fetch;
- HTML fallback image on unsupported host is rejected before fetch;
- webhook duplicate is visible in `/admin/webhooks` with status `duplicate`;
- failed Graph API event is visible in `/admin/webhooks` with error code/message (no retry action in Phase 5);
- `/admin/betas` clearly marks `approved` as public and all other statuses as not public.

- [x] **Step 6: Commit.**

```bash
git add lib/beta/fetch-guard.ts lib/beta/fetch-guard.test.ts lib/beta/instagram-html.ts lib/beta/thumbnail.ts workers/instagram-webhook/src/match.ts workers/instagram-webhook/src/thumbnail.ts lib/db/beta-queries.ts 'app/admin/(protected)/webhooks/page.tsx' 'app/admin/(protected)/betas/page.tsx'
git commit -m "feat: add beta operations safeguards"
```

---

## Task 11: Docs, Deployment, and Release Gates

**Files:**
- Create: `docs/admin-beta-operations.md`
- Modify: `docs/deployment.md`
- Modify: `docs/ROADMAP.md`

- [x] **Step 1: Write admin SOP.**

Create `docs/admin-beta-operations.md` with:
- how to review `/admin/webhooks`;
- exact rule: auto-match only when exactly one Route candidate exists;
- when to manually match vs reject;
- how to review `/admin/betas`;
- status meanings: `pending`, `approved`, `hidden`, `removed`;
- public visibility rule: only `approved` Betas appear in public route beta grids;
- duplicate handling SOP for `duplicate` webhook rows and manual duplicate submission reports;
- operational error code guide for `invalid_signature`, `graph_api_failure`, `caption_parse_failed`, `route_match_ambiguous`, `duplicate_beta`, `thumbnail_lookup_failed`, and `thumbnail_copy_failed`;
- Graph API token lifecycle SOP: where expiry is tracked, who renews it, and how to verify webhook follow-up calls after renewal;
- privacy note for raw payload retention and unclaimed Beta ownership;
- Phase 5 retry policy: there is no automatic retry. `failed` rows are operator-visible only. To re-process a failed event, the operator either redelivers from Meta App Dashboard, rejects the row, or re-creates the Beta through the manual submission form. This will be revisited in a later phase.

- [x] **Step 2: Update deployment docs.**

Modify `docs/deployment.md` to include:

```bash
pnpm wrangler d1 migrations apply granite
pnpm wrangler secret put META_APP_SECRET
pnpm wrangler secret put META_WEBHOOK_VERIFY_TOKEN
pnpm wrangler secret put INSTAGRAM_GRAPH_ACCESS_TOKEN
pnpm wrangler deploy
```

Also document Meta callback URL:

Use the deployed Worker URL shown by `pnpm wrangler deploy --dry-run` plus the fixed callback path `/webhooks/instagram`. If Cloudflare custom routes are configured, use the production custom route plus `/webhooks/instagram`.

- [x] **Step 3: Update roadmap.**

Modify `docs/ROADMAP.md` Phase 5 section so external setup remains a launch checklist and implemented code items point to this plan.

- [x] **Step 4: Full verification.**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm wrangler deploy --dry-run
```

Expected: all commands pass.

- [ ] **Step 5: End-to-end manual QA.**

Manual checklist:
- `GET /webhooks/instagram?hub.mode=subscribe&hub.verify_token=$META_WEBHOOK_VERIFY_TOKEN&hub.challenge=abc` returns `abc`.
- `POST /webhooks/instagram` with invalid HMAC returns `401`.
- Valid signed POST with known Route hashtags inserts `webhook_inbox.status='matched'` and a pending unclaimed Beta.
- Valid signed POST with ambiguous/missing hashtags inserts `webhook_inbox.status='unmatched'`.
- Duplicate signed POST marks `webhook_inbox.status='duplicate'` and does not create a second Beta.
- Manual Beta form accepts Instagram URL and YouTube URL.
- Manual Beta form rejects unsupported URL.
- `/admin/webhooks` can manual-match and reject.
- `/admin/webhooks` shows failed/duplicate metadata for operator awareness (no retry action in Phase 5).
- `/admin/betas` can approve, hide, and remove.
- Public beta video sheet shows approved Betas only.
- Pending, hidden, and removed Betas are absent from public route beta grids.
- Thumbnail failure leaves the Beta row intact.
- Thumbnail success stores a Granite CDN URL, not an Instagram CDN URL.

- [x] **Step 6: Commit.**

```bash
git add docs/admin-beta-operations.md docs/deployment.md docs/ROADMAP.md
git commit -m "docs: add phase 5 beta operations"
```

---

## Task 12: Webhook Processing Error Boundary and Stale State Visibility

**Codex finding addressed:** `processMentionEvent` runs inside `ctx.waitUntil`. After it transitions `webhook_inbox.status` from `received` to `processing`, any thrown error from the Graph API helpers (`fetch` timeout, JSON parse, network exception) abandons the row in `processing`. The admin page `/admin/webhooks` does not currently expose `received` or `processing` as filter options, so stuck rows are invisible to operators. Meta has already received a 200 ACK so it will not redeliver. Net effect: silently lost beta events.

**Files:**
- Modify: `workers/instagram-webhook/src/match.ts`
- Create: `workers/instagram-webhook/src/match.test.ts`
- Modify: `app/admin/(protected)/webhooks/page.tsx`

- [x] **Step 1: Write a failing test for the catch path.**

Create `workers/instagram-webhook/src/match.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./d1", () => ({
  insertWebhookInbox: vi.fn(),
  setWebhookInboxStatus: vi.fn(),
  insertWebhookOperationalEvent: vi.fn(),
  findExistingBetaByExternalMedia: vi.fn(),
  findPublishedRouteCandidates: vi.fn(),
  insertWebhookBeta: vi.fn(),
}));
vi.mock("./graph-api", () => ({
  fetchMentionedMedia: vi.fn(),
  fetchMentionedComment: vi.fn(),
}));
vi.mock("./thumbnail", () => ({
  attemptThumbnailCopy: vi.fn().mockResolvedValue(null),
}));

const d1 = await import("./d1");
const graph = await import("./graph-api");
const { processMentionEvent } = await import("./match");

const env = {
  META_APP_SECRET: "x",
  META_WEBHOOK_VERIFY_TOKEN: "x",
  INSTAGRAM_GRAPH_ACCESS_TOKEN: "x",
  granite_v2: {} as unknown as D1Database,
  BUCKET: {} as unknown as R2Bucket,
  CDN_BASE_URL: "https://cdn.granite.kr",
};

describe("processMentionEvent error boundary", () => {
  beforeEach(() => {
    vi.mocked(d1.insertWebhookInbox).mockReset().mockResolvedValue({ inserted: true });
    vi.mocked(d1.setWebhookInboxStatus).mockReset().mockResolvedValue(undefined);
    vi.mocked(d1.insertWebhookOperationalEvent).mockReset().mockResolvedValue(undefined);
    vi.mocked(graph.fetchMentionedMedia).mockReset();
    vi.mocked(graph.fetchMentionedComment).mockReset();
  });

  it("marks the row failed and records an operational event when Graph API throws", async () => {
    vi.mocked(graph.fetchMentionedMedia).mockRejectedValue(new Error("timeout"));

    await processMentionEvent(
      { externalId: "m1", igUserId: "u1", mediaId: "m1", commentId: null },
      env,
      "{}"
    );

    const statusCalls = vi.mocked(d1.setWebhookInboxStatus).mock.calls;
    const finalCall = statusCalls[statusCalls.length - 1][1];
    expect(finalCall.status).toBe("failed");
    expect(finalCall.lastErrorCode).toBe("graph_api_exception");

    const opEvents = vi.mocked(d1.insertWebhookOperationalEvent).mock.calls;
    expect(opEvents.some((c) => c[1].eventType === "graph_api_failure")).toBe(true);
  });

  it("does not rethrow when the recovery path itself fails", async () => {
    vi.mocked(graph.fetchMentionedMedia).mockRejectedValue(new Error("timeout"));
    vi.mocked(d1.setWebhookInboxStatus)
      .mockImplementationOnce(async () => undefined) // processing transition succeeds
      .mockImplementationOnce(async () => {
        throw new Error("d1 down");
      }); // failed transition itself throws

    await expect(
      processMentionEvent(
        { externalId: "m2", igUserId: "u1", mediaId: "m2", commentId: null },
        env,
        "{}"
      )
    ).resolves.toBeUndefined();
  });
});
```

- [x] **Step 2: Run the test and confirm it fails.**

Run: `pnpm test workers/instagram-webhook/src/match.test.ts`
Expected: at least the first test fails because the current `processMentionEvent` does not catch async exceptions — either the rejection escapes or the `failed` status is never written.

- [x] **Step 3: Wrap the processing body in try/catch in `workers/instagram-webhook/src/match.ts`.**

Read the current file. Keep the existing `insertWebhookInbox` call and the first `setWebhookInboxStatus({ id: webhookId, status: "processing", incrementAttempts: true })` call OUTSIDE the try/catch (those are the row-claim operations).

Wrap everything from `if (event.commentId)` through the thumbnail copy block in a single `try/catch`. Add this catch handler:

```ts
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await setWebhookInboxStatus(env.granite_v2, {
      id: webhookId,
      status: "failed",
      lastErrorCode: "graph_api_exception",
      lastErrorMessage: message.slice(0, 500),
    });
    await insertWebhookOperationalEvent(env.granite_v2, {
      id: uuid("opev"),
      eventType: "graph_api_failure",
      webhookId,
      betaId: null,
      requestId: "",
      method: "POST",
      path: "/webhooks/instagram",
      statusCode: null,
      message: `processMentionEvent threw: ${message}`,
      metadata: "{}",
    });
  } catch (recoveryError) {
    console.error("processMentionEvent recovery failed:", recoveryError);
  }
}
```

The code `graph_api_exception` is intentionally distinct from the existing controlled `graph_api_failure` code (which is written when the Graph API helper returns `null` without throwing). Both surface under the `graph_api_failure` operational event type because the operator-facing impact is the same.

- [x] **Step 4: Run the test and confirm it passes.**

Run: `pnpm test workers/instagram-webhook/src/match.test.ts`
Expected: 2/2 passing.

- [x] **Step 5: Expose `received` and `processing` in admin webhook filters.**

Open `app/admin/(protected)/webhooks/page.tsx`. Locate the `FILTERS` constant. Replace it with:

```ts
const FILTERS: WebhookInboxStatus[] = [
  "received",
  "processing",
  "unmatched",
  "rejected",
  "manual_matched",
  "matched",
  "duplicate",
  "failed",
];
```

Add a one-line note under the page header (next to the existing "Phase 5에선 자동 재시도가 없으므로 …" note):

```tsx
<p className="mt-1 text-[12px] text-[#7A7A7A]">
  `received`/`processing` 상태가 5분 이상 유지되는 행이 있으면 Worker 또는 Graph API 장애를 의심하세요.
</p>
```

- [x] **Step 6: Verify the full Worker test suite + typecheck + dry-run.**

```
pnpm test workers/instagram-webhook
pnpm typecheck
pnpm wrangler deploy --dry-run
```
All three must succeed.

- [x] **Step 7: Commit.**

```bash
git add workers/instagram-webhook/src/match.ts workers/instagram-webhook/src/match.test.ts 'app/admin/(protected)/webhooks/page.tsx'
git commit -m "fix(webhook): wrap processMentionEvent in try/catch and surface stale states"
```

---

## Task 13: Atomic Manual Match with Canonical Media ID

**Codex finding addressed:** `manualMatchWebhookToRoute` reads a `webhook_inbox` row by id, inserts a Beta, and updates the row's status — none of these steps gate on the row still being `unmatched`, and the function is not atomic. Worse, for comment-mention webhooks the inbox `external_id` is the `comment_id`, while auto-matched betas use the parent `media_id` as `external_media_id`. So a stale form, double-click, or admin retry can produce a second Beta row for the same Instagram media without ever colliding with the existing `uniq_betas_platform_external_media` index.

**Files:**
- Create: `migrations/0005_webhook_inbox_external_media_id.sql`
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/d1-http.ts` (add `executeD1Meta` returning row-change count)
- Modify: `lib/db/beta-queries.ts`
- Modify: `lib/db/beta-queries.test.ts`
- Modify: `lib/actions/admin-beta.ts`
- Modify: `workers/instagram-webhook/src/d1.ts`
- Modify: `workers/instagram-webhook/src/match.ts`
- Modify: `docs/DATA_MODEL.md`

- [x] **Step 1: Write migration `0005_webhook_inbox_external_media_id.sql`.**

Create `migrations/0005_webhook_inbox_external_media_id.sql`:

```sql
-- Granite Phase 5 — store canonical Instagram media_id on the webhook_inbox row.
-- For comment mentions, external_id is the comment_id, which is NOT the same as
-- the media id used by betas.external_media_id. Manual matching and duplicate
-- detection must compare on this canonical id to be safe.
-- Roll-forward only.

ALTER TABLE webhook_inbox ADD COLUMN external_media_id TEXT;

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_external_media_id
  ON webhook_inbox (external_media_id);
```

- [x] **Step 2: Extend the `WebhookInbox` TS type.**

In `lib/db/schema.ts`, add `externalMediaId: string | null;` to the `WebhookInbox` type immediately after `externalId`. Do not remove or rename any existing field.

- [x] **Step 3: Add `executeD1Meta` to `lib/db/d1-http.ts`.**

The existing `executeQuery` internal helper returns rows only and discards `meta`. Refactor minimally so meta is available, then add the new export. Concrete change:

(a) Extend the response envelope types:

```ts
interface D1Meta {
  changes?: number;
  last_row_id?: number;
  duration?: number;
  rows_read?: number;
  rows_written?: number;
}

interface D1ResultEntry<T> {
  results: T[];
  meta?: D1Meta;
}
```

(b) Add an internal helper `executeQueryWithMeta` and reimplement `executeQuery` as a thin wrapper. Keep the existing error-handling path unchanged:

```ts
async function executeQueryWithMeta<T>(
  sql: string,
  params: unknown[]
): Promise<{ rows: T[]; meta: D1Meta }> {
  const { url, token, databaseId } = getEnvVars();
  const endpoint = buildEndpoint(url, databaseId);

  const response = await globalThis.fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!response.ok) {
    let errorDetail = "";
    try {
      const body = (await response.json()) as Partial<D1Envelope<T>>;
      if (Array.isArray(body.errors) && body.errors.length > 0) {
        errorDetail = body.errors.map((e) => e.message).join("; ");
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(
      errorDetail
        ? `D1 query failed (${response.status}): ${errorDetail}`
        : `D1 query failed with HTTP ${response.status}`
    );
  }

  const body = (await response.json()) as D1Envelope<T>;
  if (!body.success) {
    const errorDetail =
      Array.isArray(body.errors) && body.errors.length > 0
        ? body.errors.map((e) => e.message).join("; ")
        : "unknown error";
    throw new Error(`D1 query failed: ${errorDetail}`);
  }

  return {
    rows: body.result?.[0]?.results ?? [],
    meta: body.result?.[0]?.meta ?? {},
  };
}

async function executeQuery<T>(sql: string, params: unknown[]): Promise<T[]> {
  const { rows } = await executeQueryWithMeta<T>(sql, params);
  return rows;
}
```

(c) Add the new exported helper:

```ts
/**
 * Execute a mutation (INSERT/UPDATE/DELETE) and return the number of rows changed.
 * Use this when caller logic depends on whether a conditional UPDATE actually
 * claimed the row (e.g. `UPDATE ... WHERE id = ? AND status = 'unmatched'`).
 */
export async function executeD1Meta(
  sql: string,
  params?: unknown[]
): Promise<{ changes: number }> {
  const { meta } = await executeQueryWithMeta<unknown>(sql, params ?? []);
  return { changes: meta.changes ?? 0 };
}
```

Do not rename or remove `queryD1`, `queryD1First`, `executeD1`, or `pingD1`. Verify with `pnpm typecheck` after this step.

- [x] **Step 4: Update `insertWebhookInbox` in `lib/db/beta-queries.ts` to accept and store `externalMediaId`.**

Replace the existing `insertWebhookInbox` body with:

```ts
export async function insertWebhookInbox(input: {
  id: string;
  externalId: string;
  externalMediaId: string | null;
  igUserId: string;
  igUsername: string;
  caption: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  rawPayload: string;
}): Promise<void> {
  await queryD1(
    `INSERT OR IGNORE INTO webhook_inbox (
       id, provider, external_id, external_media_id, ig_user_id, ig_username, caption,
       media_url, thumbnail_url, matched_beta_id, status, raw_payload
     ) VALUES (?, 'instagram', ?, ?, ?, ?, ?, ?, ?, NULL, 'received', ?)`,
    [
      input.id,
      input.externalId,
      input.externalMediaId,
      input.igUserId,
      input.igUsername,
      input.caption,
      input.mediaUrl,
      input.thumbnailUrl,
      input.rawPayload,
    ]
  );
}
```

- [x] **Step 5: Replace `manualMatchWebhookToRoute` with the atomic-claim + dedup version.**

In `lib/db/beta-queries.ts`, replace the existing `manualMatchWebhookToRoute` with:

```ts
import { executeD1Meta, queryD1 } from "./d1-http"; // adjust existing import if needed

export type ManualMatchOutcome =
  | { ok: true; betaId: string }
  | { ok: false; reason: "not_unmatched" }
  | { ok: false; reason: "duplicate"; existingBetaId: string };

export async function manualMatchWebhookToRoute(input: {
  webhookId: string;
  routeId: string;
  betaId: string;
}): Promise<ManualMatchOutcome> {
  // 1) Atomically claim the row: unmatched -> manual_matched. matched_beta_id stays NULL
  //    until we successfully insert the Beta in step 4.
  const claim = await executeD1Meta(
    `UPDATE webhook_inbox
     SET status = 'manual_matched', updated_at = datetime('now')
     WHERE id = ? AND status = 'unmatched'`,
    [input.webhookId]
  );
  if (claim.changes === 0) {
    return { ok: false, reason: "not_unmatched" };
  }

  // 2) Read the claimed row.
  const rows = await queryD1<{
    igUsername: string;
    caption: string;
    mediaUrl: string;
    externalId: string;
    externalMediaId: string | null;
  }>(
    `SELECT
       ig_username AS igUsername,
       caption,
       media_url AS mediaUrl,
       external_id AS externalId,
       external_media_id AS externalMediaId
     FROM webhook_inbox
     WHERE id = ?
     LIMIT 1`,
    [input.webhookId]
  );
  if (rows.length === 0) {
    // Should never happen — we just claimed the row. Revert defensively.
    await queryD1(
      `UPDATE webhook_inbox SET status = 'unmatched', updated_at = datetime('now') WHERE id = ?`,
      [input.webhookId]
    );
    return { ok: false, reason: "not_unmatched" };
  }
  const row = rows[0];

  // 3) Canonical media id dedup. New rows have external_media_id; legacy rows fall back to external_id.
  const canonicalMediaId = row.externalMediaId ?? row.externalId;
  const existing = await findExistingBetaByExternalMedia("instagram", canonicalMediaId);
  if (existing) {
    await queryD1(
      `UPDATE webhook_inbox
       SET status = 'duplicate',
           matched_beta_id = ?,
           last_error_code = 'duplicate_beta',
           updated_at = datetime('now')
       WHERE id = ?`,
      [existing.id, input.webhookId]
    );
    return { ok: false, reason: "duplicate", existingBetaId: existing.id };
  }

  // 4) Insert the Beta with the canonical media id as external_media_id.
  const today = new Date().toISOString().slice(0, 10);
  await queryD1(
    `INSERT INTO betas (
       id, route_id, user_id, instagram_id, display_name, source, platform,
       media_url, permalink_url, external_media_id, thumbnail_url, sent_at, status, claim_status
     ) VALUES (?, ?, NULL, ?, ?, 'instagram_webhook', 'instagram', ?, NULL, ?, NULL, ?, 'pending', 'unclaimed')`,
    [
      input.betaId,
      input.routeId,
      row.igUsername,
      row.igUsername,
      row.mediaUrl,
      canonicalMediaId,
      today,
    ]
  );

  // 5) Finalize the webhook row with the new Beta id.
  await queryD1(
    `UPDATE webhook_inbox
     SET matched_beta_id = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [input.betaId, input.webhookId]
  );

  return { ok: true, betaId: input.betaId };
}
```

- [x] **Step 6: Update `manualMatchWebhookAction` in `lib/actions/admin-beta.ts` to handle the three-way outcome.**

Replace the existing `manualMatchWebhookAction` body with:

```ts
export async function manualMatchWebhookAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = manualMatchSchema.parse(Object.fromEntries(formData));
  const result = await manualMatchWebhookToRoute({
    webhookId: parsed.webhookId,
    routeId: parsed.routeId,
    betaId: `beta_${randomUUID()}`,
  });

  if (result.ok) {
    await insertAdminAuditLog({
      adminId: admin.adminId,
      action: "webhook.manual_match",
      targetType: "webhook_inbox",
      targetId: parsed.webhookId,
      metadata: { routeId: parsed.routeId, betaId: result.betaId },
    });
    revalidatePath("/admin/webhooks");
    revalidatePath("/admin/betas");
    return;
  }

  await insertAdminAuditLog({
    adminId: admin.adminId,
    action: "webhook.manual_match_skipped",
    targetType: "webhook_inbox",
    targetId: parsed.webhookId,
    metadata:
      result.reason === "duplicate"
        ? { routeId: parsed.routeId, reason: "duplicate", existingBetaId: result.existingBetaId }
        : { routeId: parsed.routeId, reason: result.reason },
  });
  revalidatePath("/admin/webhooks");
}
```

The Server Action signature stays `Promise<void>` — the audit log records why a no-op happened. UI surfacing of these outcomes is a follow-up polish.

- [x] **Step 7: Update `lib/db/beta-queries.test.ts`.**

Two changes:

(a) Update the existing `insertWebhookInbox` test call to include `externalMediaId: "ig_media_1"` and assert that the SQL contains `external_media_id`:

```ts
it("inserts webhook inbox idempotency rows", async () => {
  vi.mocked(queryD1).mockResolvedValue([]);
  await insertWebhookInbox({
    id: "webhook_1",
    externalId: "ig_comment_1",
    externalMediaId: "ig_media_1",
    igUserId: "ig_user_1",
    igUsername: "climber",
    caption: "@granite.kr #큰바위 #SkyHook",
    mediaUrl: "https://www.instagram.com/p/abc/",
    thumbnailUrl: null,
    rawPayload: "{}",
  });

  expect(queryD1).toHaveBeenCalledWith(
    expect.stringContaining("INSERT OR IGNORE INTO webhook_inbox"),
    expect.any(Array)
  );
  expect(queryD1).toHaveBeenCalledWith(
    expect.stringContaining("external_media_id"),
    expect.any(Array)
  );
});
```

(b) Append three new tests for `manualMatchWebhookToRoute` (also add `executeD1Meta` to the `vi.mock("./d1-http", ...)` factory at the top of the file):

```ts
import { manualMatchWebhookToRoute } from "./beta-queries"; // add to top import block

// ... existing vi.mock("./d1-http", ...) must be updated to:
// vi.mock("./d1-http", () => ({ queryD1: vi.fn(), queryD1First: vi.fn(), executeD1Meta: vi.fn() }));
const { executeD1Meta } = await import("./d1-http");

describe("manualMatchWebhookToRoute", () => {
  beforeEach(() => {
    vi.mocked(queryD1).mockReset();
    vi.mocked(executeD1Meta).mockReset();
  });

  it("claims an unmatched row, dedup-checks, and inserts a beta with the canonical media id", async () => {
    vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });
    vi.mocked(queryD1)
      .mockResolvedValueOnce([
        {
          igUsername: "climber",
          caption: "@granite.kr #큰바위 #SkyHook",
          mediaUrl: "https://www.instagram.com/p/abc/",
          externalId: "comment_1",
          externalMediaId: "media_1",
        },
      ]) // SELECT
      .mockResolvedValueOnce([]) // findExistingBetaByExternalMedia
      .mockResolvedValueOnce([]) // INSERT betas
      .mockResolvedValueOnce([]); // UPDATE finalize

    const outcome = await manualMatchWebhookToRoute({
      webhookId: "webhook_1",
      routeId: "route_1",
      betaId: "beta_new",
    });

    expect(outcome).toEqual({ ok: true, betaId: "beta_new" });
    const insertCall = vi
      .mocked(queryD1)
      .mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO betas")
      );
    expect(insertCall?.[1]).toContain("media_1"); // canonical media id, not "comment_1"
  });

  it("returns not_unmatched when the row is no longer claimable", async () => {
    vi.mocked(executeD1Meta).mockResolvedValue({ changes: 0 });
    const outcome = await manualMatchWebhookToRoute({
      webhookId: "webhook_1",
      routeId: "route_1",
      betaId: "beta_new",
    });
    expect(outcome).toEqual({ ok: false, reason: "not_unmatched" });
    expect(queryD1).not.toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO betas"),
      expect.anything()
    );
  });

  it("returns duplicate without inserting a new beta when canonical media exists", async () => {
    vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });
    vi.mocked(queryD1)
      .mockResolvedValueOnce([
        {
          igUsername: "climber",
          caption: "@granite.kr #큰바위 #SkyHook",
          mediaUrl: "https://www.instagram.com/p/abc/",
          externalId: "comment_1",
          externalMediaId: "media_1",
        },
      ]) // SELECT
      .mockResolvedValueOnce([{ id: "beta_existing", status: "pending" }]) // findExisting
      .mockResolvedValueOnce([]); // UPDATE webhook to duplicate

    const outcome = await manualMatchWebhookToRoute({
      webhookId: "webhook_1",
      routeId: "route_1",
      betaId: "beta_new",
    });

    expect(outcome).toEqual({
      ok: false,
      reason: "duplicate",
      existingBetaId: "beta_existing",
    });
    const insertCalls = vi
      .mocked(queryD1)
      .mock.calls.filter(
        (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO betas")
      );
    expect(insertCalls.length).toBe(0);
  });
});
```

If the existing `findExistingBetaByExternalMedia` uses `queryD1First` instead of `queryD1`, adjust the second mock to use `queryD1First.mockResolvedValueOnce(...)` and supply a single object or `null`. Match the actual implementation rather than guessing.

- [x] **Step 8: Update Worker `insertWebhookInbox` signature.**

In `workers/instagram-webhook/src/d1.ts`, extend the parameter shape and SQL to include `external_media_id`:

```ts
export async function insertWebhookInbox(
  db: D1Database,
  input: {
    id: string;
    externalId: string;
    externalMediaId: string | null;
    igUserId: string;
    igUsername: string;
    caption: string;
    mediaUrl: string;
    thumbnailUrl: string | null;
    rawPayload: string;
  }
): Promise<{ inserted: boolean }> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO webhook_inbox (
         id, provider, external_id, external_media_id, ig_user_id, ig_username, caption,
         media_url, thumbnail_url, matched_beta_id, status, raw_payload
       ) VALUES (?, 'instagram', ?, ?, ?, ?, ?, ?, ?, NULL, 'received', ?)`
    )
    .bind(
      input.id,
      input.externalId,
      input.externalMediaId,
      input.igUserId,
      input.igUsername,
      input.caption,
      input.mediaUrl,
      input.thumbnailUrl,
      input.rawPayload
    )
    .run();
  return { inserted: (result.meta.changes ?? 0) > 0 };
}
```

- [x] **Step 9: Pass `externalMediaId: event.mediaId` from `workers/instagram-webhook/src/match.ts`.**

In match.ts, update the single `insertWebhookInbox(env.granite_v2, { ... })` call site:

```ts
const inserted = await insertWebhookInbox(env.granite_v2, {
  id: webhookId,
  externalId: event.externalId,
  externalMediaId: event.mediaId,
  igUserId: event.igUserId,
  igUsername: "",
  caption: "",
  mediaUrl: "",
  thumbnailUrl: null,
  rawPayload,
});
```

For comment mentions `event.externalId` is the comment_id; for caption mentions `event.externalId === event.mediaId`. Either way `externalMediaId` is the canonical media id and is safe for duplicate detection.

- [x] **Step 10: Update `docs/DATA_MODEL.md`.**

In the `webhook_inbox` table description, add a row for `external_media_id`:

> `external_media_id` — Canonical Instagram `media_id`. For caption mentions equals `external_id`; for comment mentions equals the parent `media_id` while `external_id` remains the `comment_id` idempotency key. Used by admin manual matching for duplicate detection against `betas.external_media_id`. Nullable for rows created before migration `0005`.

- [x] **Step 11: Verify.**

```
pnpm test lib/db/beta-queries.test.ts
pnpm test workers/instagram-webhook
pnpm test lib/actions/admin-beta.test.ts
pnpm typecheck
pnpm wrangler deploy --dry-run
```
All five must succeed.

- [x] **Step 12: Mark Product Scope duplicate-prevention item complete.**

In this plan file (`docs/plans/2026-06-02-granite-phase-5.md`), find:

```
- [ ] Duplicate Beta creation is prevented across manual submissions, webhook retries, and admin manual matching.
```

Change to `- [x]`.

- [x] **Step 13: Commit.**

```bash
git add migrations/0005_webhook_inbox_external_media_id.sql lib/db/schema.ts lib/db/d1-http.ts lib/db/beta-queries.ts lib/db/beta-queries.test.ts lib/actions/admin-beta.ts workers/instagram-webhook/src/d1.ts workers/instagram-webhook/src/match.ts docs/DATA_MODEL.md docs/plans/2026-06-02-granite-phase-5.md
git commit -m "fix(webhook): atomic manual match with canonical media id"
```

---

## Task 14: Hydrate `webhook_inbox` with Graph API Response Data

**Codex finding addressed:** `processMentionEvent` inserts the inbox row with empty `ig_username`, `caption`, `media_url`, `thumbnail_url`. After the Graph API helpers resolve, the data is held only in local variables and never written to the database. The admin webhook inbox therefore shows blank captions and missing media links — so operators cannot reason about `unmatched`/`failed`/`duplicate` rows. Worse, `manualMatchWebhookToRoute` (Task 13) SELECTs those same empty columns and feeds them into `INSERT INTO betas`, producing public Beta rows with blank handle/display name/media URL. The entire Phase 5 manual-recovery story is non-functional until hydration lands.

**Files:**
- Modify: `workers/instagram-webhook/src/d1.ts` (add `hydrateWebhookInbox`)
- Modify: `workers/instagram-webhook/src/match.ts` (call hydrate after Graph API resolves)
- Modify: `workers/instagram-webhook/src/match.test.ts` (assert hydrate is invoked with the resolved values)
- Modify: `docs/plans/2026-06-02-granite-phase-5.md` (mark Task 14 step checkboxes)

- [x] **Step 1: Add the failing hydration assertion.**

Open `workers/instagram-webhook/src/match.test.ts`. Add `hydrateWebhookInbox: vi.fn()` to the `vi.mock("./d1", ...)` factory, alongside the existing helpers. Add a new test at the bottom of the `describe("processMentionEvent error boundary", ...)` block (or in a new sibling `describe` named `"processMentionEvent hydration"`):

```ts
it("hydrates webhook_inbox with resolved Graph API fields before transitioning status", async () => {
  vi.mocked(graph.fetchMentionedMedia).mockResolvedValue({
    username: "@Climber",
    caption: "@granite.kr #큰바위 #SkyHook",
    mediaUrl: "https://video.cdninstagram.com/abc",
    thumbnailUrl: "https://scontent.cdninstagram.com/abc.jpg",
    permalink: "https://www.instagram.com/p/abc/",
  });
  vi.mocked(d1.findPublishedRouteCandidates).mockResolvedValue([]); // force unmatched

  await processMentionEvent(
    { externalId: "m3", igUserId: "u1", mediaId: "m3", commentId: null },
    env,
    "{}"
  );

  expect(d1.hydrateWebhookInbox).toHaveBeenCalledWith(
    env.granite_v2,
    expect.objectContaining({
      id: expect.any(String),
      igUsername: "climber", // normalized: @ stripped, lowercased
      caption: "@granite.kr #큰바위 #SkyHook",
      mediaUrl: "https://video.cdninstagram.com/abc",
      permalinkUrl: "https://www.instagram.com/p/abc/",
    })
  );

  // hydrate must run BEFORE the final unmatched/matched status transition
  const hydrateOrder = vi.mocked(d1.hydrateWebhookInbox).mock.invocationCallOrder[0];
  const statusOrder = vi.mocked(d1.setWebhookInboxStatus).mock.invocationCallOrder;
  const lastStatusOrder = statusOrder[statusOrder.length - 1];
  expect(hydrateOrder).toBeLessThan(lastStatusOrder);
});
```

- [x] **Step 2: Run the test and confirm it fails.**

```
pnpm test workers/instagram-webhook/src/match.test.ts
```
Expected: this new test fails because `hydrateWebhookInbox` does not exist yet.

- [x] **Step 3: Add `hydrateWebhookInbox` to `workers/instagram-webhook/src/d1.ts`.**

Append next to the other inbox helpers:

```ts
export async function hydrateWebhookInbox(
  db: D1Database,
  input: {
    id: string;
    igUsername: string;
    caption: string;
    mediaUrl: string;
    permalinkUrl: string | null;
    thumbnailUrl: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `UPDATE webhook_inbox SET
         ig_username = ?,
         caption = ?,
         media_url = ?,
         thumbnail_url = ?,
         updated_at = datetime('now')
       WHERE id = ?`
    )
    .bind(
      input.igUsername,
      input.caption,
      input.mediaUrl,
      input.thumbnailUrl,
      input.id
    )
    .run();
}
```

Note: `webhook_inbox` has no `permalink_url` column today. `permalinkUrl` is included in the helper signature for symmetry with `betas.permalink_url` and so the controller (match.ts) can pass it; we drop it in the SQL until/unless a future migration adds the column. Keeping it in the signature documents intent without a schema change.

- [x] **Step 4: Call `hydrateWebhookInbox` from `workers/instagram-webhook/src/match.ts`.**

Inside the existing `try` block (Task 12 wrapper), AFTER both `fetchMentionedComment` (if applicable) and `fetchMentionedMedia` have resolved successfully, and BEFORE the duplicate check, insert:

```ts
const igUsername = normalizeHandle(media.username);
if (!captionText) captionText = media.caption;

await hydrateWebhookInbox(env.granite_v2, {
  id: webhookId,
  igUsername,
  caption: captionText,
  mediaUrl: media.mediaUrl ?? media.permalink ?? "",
  permalinkUrl: media.permalink,
  thumbnailUrl: media.thumbnailUrl,
});
```

The existing `const igUsername = normalizeHandle(media.username);` and `if (!captionText) captionText = media.caption;` lines should ALREADY appear earlier — move them above the hydrate call if needed so the hydrate sees the normalized handle. Remove any duplicate later assignment.

Add `hydrateWebhookInbox` to the existing `import { ... } from "./d1";` block.

- [x] **Step 5: Run the test and confirm it passes.**

```
pnpm test workers/instagram-webhook/src/match.test.ts
```
Expected: 3/3 (or 4/4 if you added it as a new test in a sibling describe) green.

- [x] **Step 6: Full verification.**

```
pnpm test workers/instagram-webhook
pnpm typecheck
pnpm wrangler deploy --dry-run
```
All three must pass.

- [x] **Step 7: Mark Task 14 step checkboxes complete in this plan file.**

In `docs/plans/2026-06-02-granite-phase-5.md`, change every `- [ ] **Step N:` line inside Task 14 to `- [x] **Step N:`. Include Step 7 itself (your last action before the commit step).

- [x] **Step 8: Commit.**

```bash
git add workers/instagram-webhook/src/d1.ts workers/instagram-webhook/src/match.ts workers/instagram-webhook/src/match.test.ts docs/plans/2026-06-02-granite-phase-5.md
git commit -m "fix(webhook): hydrate inbox with graph api response before status transitions"
```

---

## Task 15: Manual Match Partial-Failure Recovery and Orphan Visibility

**Codex finding addressed:** Task 13's `manualMatchWebhookToRoute` makes 5 separate D1 HTTP calls (atomic claim → SELECT row → `findExistingBetaByExternalMedia` → INSERT beta → finalize matched_beta_id). Each is a network round-trip. If steps 4 or 5 fail, the row's status is already `manual_matched` but `matched_beta_id` may be NULL (orphan) or the Beta may exist without a back-link. The Phase 5 Self-Review noted this as "acceptable for admin-gated low-volume operations" but Codex's partial-failure framing is correct: there is no compensating action, and the admin UI doesn't surface the orphan state.

**Files:**
- Modify: `lib/db/beta-queries.ts` (compensating revert + operational events around partial failures)
- Modify: `lib/db/beta-queries.test.ts` (partial failure tests)
- Modify: `app/admin/(protected)/webhooks/page.tsx` (orphan callout for `manual_matched + matched_beta_id IS NULL`)
- Modify: `docs/plans/2026-06-02-granite-phase-5.md` (mark Task 15 step checkboxes)

- [x] **Step 1: Write failing tests for partial-failure recovery.**

Open `lib/db/beta-queries.test.ts`. Add `insertWebhookOperationalEvent: vi.fn()` to the `vi.mock` factory if it's not already there. Then append these tests at the end of the existing `describe("manualMatchWebhookToRoute", ...)` block:

```ts
it("reverts to unmatched and logs orphan event when beta insert fails", async () => {
  vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });

  const insertError = new Error("D1 UNIQUE constraint");
  vi.mocked(queryD1)
    .mockResolvedValueOnce([
      {
        igUsername: "climber",
        caption: "@granite.kr #큰바위 #SkyHook",
        mediaUrl: "https://www.instagram.com/p/abc/",
        externalId: "comment_1",
        externalMediaId: "media_1",
      },
    ]) // SELECT row
    .mockRejectedValueOnce(insertError) // INSERT betas FAILS
    .mockResolvedValueOnce([]); // compensating revert UPDATE
  vi.mocked(queryD1First).mockResolvedValueOnce(null); // findExistingBetaByExternalMedia

  const { manualMatchWebhookToRoute } = await import("./beta-queries");

  const outcome = await manualMatchWebhookToRoute({
    webhookId: "webhook_1",
    routeId: "route_1",
    betaId: "beta_new",
  });

  expect(outcome).toEqual({ ok: false, reason: "not_unmatched" });

  // Compensating revert ran: status back to unmatched
  const revertCall = vi
    .mocked(queryD1)
    .mock.calls.find(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("UPDATE webhook_inbox") &&
        c[0].includes("status = 'unmatched'")
    );
  expect(revertCall).toBeDefined();
});

it("logs orphan event when finalize update fails", async () => {
  vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });
  const finalizeError = new Error("D1 network blip");
  vi.mocked(queryD1)
    .mockResolvedValueOnce([
      {
        igUsername: "climber",
        caption: "@granite.kr #큰바위 #SkyHook",
        mediaUrl: "https://www.instagram.com/p/abc/",
        externalId: "comment_1",
        externalMediaId: "media_1",
      },
    ]) // SELECT row
    .mockResolvedValueOnce([]) // INSERT betas (success)
    .mockRejectedValueOnce(finalizeError); // finalize UPDATE FAILS
  vi.mocked(queryD1First).mockResolvedValueOnce(null); // findExistingBetaByExternalMedia

  const { manualMatchWebhookToRoute } = await import("./beta-queries");

  await expect(
    manualMatchWebhookToRoute({
      webhookId: "webhook_1",
      routeId: "route_1",
      betaId: "beta_new",
    })
  ).rejects.toThrow(finalizeError);

  // Beta was inserted before the failure
  const insertCall = vi
    .mocked(queryD1)
    .mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO betas")
    );
  expect(insertCall).toBeDefined();
});
```

- [x] **Step 2: Run the tests and confirm they fail.**

```
pnpm test lib/db/beta-queries.test.ts
```
Expected: the two new tests fail because `manualMatchWebhookToRoute` does not compensate on partial failure.

- [x] **Step 3: Add compensating revert + orphan logging to `manualMatchWebhookToRoute`.**

In `lib/db/beta-queries.ts`, replace steps 4 and 5 of the existing `manualMatchWebhookToRoute` body (the INSERT-betas block and the finalize-matched_beta_id UPDATE) with a try/catch wrapper:

```ts
// 4) Insert the Beta with the canonical media id.
const today = new Date().toISOString().slice(0, 10);
try {
  await queryD1(
    `INSERT INTO betas (
       id, route_id, user_id, instagram_id, display_name, source, platform,
       media_url, permalink_url, external_media_id, thumbnail_url, sent_at, status, claim_status
     ) VALUES (?, ?, NULL, ?, ?, 'instagram_webhook', 'instagram', ?, NULL, ?, NULL, ?, 'pending', 'unclaimed')`,
    [
      input.betaId,
      input.routeId,
      row.igUsername,
      row.igUsername,
      row.mediaUrl,
      canonicalMediaId,
      today,
    ]
  );
} catch (insertError) {
  // Compensating revert: release the claim so an operator can retry.
  await queryD1(
    `UPDATE webhook_inbox
     SET status = 'unmatched',
         last_error_code = 'manual_match_insert_failed',
         last_error_message = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      insertError instanceof Error ? insertError.message.slice(0, 500) : "insert failed",
      input.webhookId,
    ]
  );
  return { ok: false, reason: "not_unmatched" };
}

// 5) Finalize the webhook row with the new Beta id.
try {
  await queryD1(
    `UPDATE webhook_inbox
     SET matched_beta_id = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [input.betaId, input.webhookId]
  );
} catch (finalizeError) {
  // The Beta exists but the inbox can't be back-linked. Log as orphan and rethrow
  // so the admin Server Action surfaces an error to the operator; the row will
  // appear in /admin/webhooks under manual_matched + matched_beta_id IS NULL.
  try {
    await insertWebhookOperationalEvent({
      id: `opev_${crypto.randomUUID()}`,
      eventType: "duplicate_beta", // closest existing event_type for orphan beta tracking
      webhookId: input.webhookId,
      betaId: input.betaId,
      requestId: "",
      method: "POST",
      path: "/admin/webhooks/manual-match",
      statusCode: null,
      message: "manual match finalize failed; beta orphaned (inbox missing matched_beta_id)",
      metadata: JSON.stringify({ kind: "orphan_beta", reason: finalizeError instanceof Error ? finalizeError.message : "unknown" }),
    });
  } catch {
    // Best effort: do not lose the original error if the op-event insert also fails.
  }
  throw finalizeError;
}

return { ok: true, betaId: input.betaId };
```

Note on event_type reuse: the existing CHECK constraint on `webhook_operational_events.event_type` (migration 0004) does not include an `orphan_beta` value. Reusing `duplicate_beta` keeps the migration footprint zero and uses `metadata.kind` to differentiate orphan vs duplicate. If a follow-up phase adds an `orphan_beta` event_type via migration, callers can switch.

Ensure `insertWebhookOperationalEvent` is imported in this file (it should already be exported from the same module per Task 3).

- [x] **Step 4: Run the tests and confirm they pass.**

```
pnpm test lib/db/beta-queries.test.ts
```
Expected: 7/7 or 8/8 passing (existing manualMatchWebhookToRoute tests + the two new ones).

- [x] **Step 5: Surface orphan rows in `/admin/webhooks`.**

Read `app/admin/(protected)/webhooks/page.tsx`. The page already lists `manual_matched` rows. Add a separate "고립된 매칭" section above (or below) the main table, populated by a new query that returns rows where `status = 'manual_matched' AND matched_beta_id IS NULL`. Add the query to `lib/db/beta-queries.ts`:

```ts
export async function getOrphanedManualMatches(): Promise<WebhookInboxAdminRow[]> {
  return queryD1<WebhookInboxAdminRow>(
    `SELECT
       id,
       external_id AS externalId,
       ig_username AS igUsername,
       caption,
       media_url AS mediaUrl,
       thumbnail_url AS thumbnailUrl,
       matched_beta_id AS matchedBetaId,
       status,
       processing_attempts AS processingAttempts,
       last_error_code AS lastErrorCode,
       last_error_message AS lastErrorMessage,
       received_at AS receivedAt,
       updated_at AS updatedAt
     FROM webhook_inbox
     WHERE status = 'manual_matched' AND matched_beta_id IS NULL
     ORDER BY updated_at DESC`,
    []
  );
}
```

In `app/admin/(protected)/webhooks/page.tsx`, call this in parallel with the existing data and render a callout. Suggested skeleton:

```tsx
const [rows, routes, opEvents, orphans] = await Promise.all([
  getAdminWebhookInbox(status),
  getAdminRoutes(),
  getRecentWebhookOperationalEvents(50),
  getOrphanedManualMatches(),
]);
```

Above the main table render a section that's hidden when `orphans.length === 0`:

```tsx
{orphans.length > 0 ? (
  <AdminCard>
    <h2 className="mb-2 text-[14px] font-bold text-[#B53A3A]">
      고립된 매칭 ({orphans.length})
    </h2>
    <p className="mb-2 text-[12px] text-[#7A7A7A]">
      `manual_matched` 상태인데 `matched_beta_id`가 비어 있는 행입니다. 매뉴얼 매칭 finalize 단계 실패 가능성이 있습니다. 운영자가 Beta 존재 여부를 확인하고 직접 SQL로 재연결하거나 거절해 주세요.
    </p>
    <AdminTable>
      {orphans.map((row) => (
        <AdminTableRow key={row.id}>
          <AdminTableCell>{row.receivedAt}</AdminTableCell>
          <AdminTableCell>@{row.igUsername || "-"}</AdminTableCell>
          <AdminTableCell>
            <span className="line-clamp-2">{row.caption || "-"}</span>
          </AdminTableCell>
          <AdminTableCell>{row.lastErrorCode || "-"}</AdminTableCell>
        </AdminTableRow>
      ))}
    </AdminTable>
  </AdminCard>
) : null}
```

Match the existing admin styles. Do not provide UI actions in this task — orphan recovery is operator-by-SQL until a follow-up phase.

- [x] **Step 6: Verify.**

```
pnpm test lib/db/beta-queries.test.ts
pnpm typecheck
pnpm build
pnpm wrangler deploy --dry-run
```
All must pass.

- [x] **Step 7: Mark Task 15 step checkboxes complete in this plan file.**

In `docs/plans/2026-06-02-granite-phase-5.md`, change every `- [ ] **Step N:` line inside Task 15 to `- [x] **Step N:`. Include Step 7 itself (last action before the commit step).

- [x] **Step 8: Commit.**

```bash
git add lib/db/beta-queries.ts lib/db/beta-queries.test.ts 'app/admin/(protected)/webhooks/page.tsx' docs/plans/2026-06-02-granite-phase-5.md
git commit -m "fix(webhook): manual match partial-failure recovery and orphan visibility"
```

---

## Task 16: State-Aware Webhook Idempotency for Meta Redelivery

**Codex finding addressed:** `processMentionEvent` uses `INSERT OR IGNORE` for idempotency. When Meta redelivers a webhook whose `external_id` already exists, the early `return` runs regardless of the existing row's status. This makes the documented recovery path — "operator redelivers from Meta App Dashboard" (Task 11 SOP) — a silent no-op for `failed` / `received` / `processing` / `unmatched` rows. The webhook fix that Phase 5 relies on for recoverable beta loss is therefore broken.

The fix is state-aware idempotency:
- Terminal statuses (`matched`, `duplicate`, `rejected`, `manual_matched`) → continue to no-op. These are the genuine "already done" cases.
- Non-terminal statuses (`received`, `processing`, `failed`, `unmatched`) → atomically reclaim the existing row to `processing` and re-run the full pipeline using the existing webhook id.

`unmatched` reclaim is intentional: operators may publish a new Route after the first attempt, in which case a redelivery should succeed. The cost of an extra Graph API call for unrecoverable `unmatched` rows is bounded by the Meta dashboard's manual redelivery rate.

**Files:**
- Modify: `workers/instagram-webhook/src/d1.ts` (add `tryReclaimWebhookForRetry`)
- Modify: `workers/instagram-webhook/src/match.ts` (replace early-return with state-aware reclaim)
- Modify: `workers/instagram-webhook/src/match.test.ts` (3 new tests)
- Modify: `docs/plans/2026-06-02-granite-phase-5.md` (checkboxes)

- [ ] **Step 1: Write failing tests for the redelivery scenarios.**

Open `workers/instagram-webhook/src/match.test.ts`. Add `tryReclaimWebhookForRetry: vi.fn()` to the existing `vi.mock("./d1", ...)` factory. Append three tests at the end of the `describe("processMentionEvent error boundary", ...)` block (or in a sibling `describe("processMentionEvent redelivery")`):

```ts
it("no-ops when Meta redelivers a terminal-state row", async () => {
  // First call inserted=false (existing row), reclaim returns null (terminal).
  vi.mocked(d1.insertWebhookInbox).mockResolvedValueOnce({ inserted: false });
  vi.mocked(d1.tryReclaimWebhookForRetry).mockResolvedValueOnce(null);

  await processMentionEvent(
    { externalId: "m_terminal", igUserId: "u1", mediaId: "m_terminal", commentId: null },
    env,
    "{}"
  );

  // Graph API must NOT be called for terminal rows.
  expect(graph.fetchMentionedMedia).not.toHaveBeenCalled();
  // No status transitions either (the existing terminal status is preserved).
  expect(d1.setWebhookInboxStatus).not.toHaveBeenCalled();
});

it("reprocesses a failed row when Meta redelivers", async () => {
  vi.mocked(d1.insertWebhookInbox).mockResolvedValueOnce({ inserted: false });
  vi.mocked(d1.tryReclaimWebhookForRetry).mockResolvedValueOnce({
    webhookId: "webhook_existing",
    currentStatus: "failed",
  });
  vi.mocked(graph.fetchMentionedMedia).mockResolvedValueOnce({
    username: "@Climber",
    caption: "@granite.kr #큰바위 #SkyHook",
    mediaUrl: "https://video.cdninstagram.com/abc",
    thumbnailUrl: "https://scontent.cdninstagram.com/abc.jpg",
    permalink: "https://www.instagram.com/p/abc/",
  });
  vi.mocked(d1.findPublishedRouteCandidates).mockResolvedValueOnce([]); // force unmatched

  await processMentionEvent(
    { externalId: "m_failed", igUserId: "u1", mediaId: "m_failed", commentId: null },
    env,
    "{}"
  );

  // Hydration uses the EXISTING webhook id (not a new one).
  expect(d1.hydrateWebhookInbox).toHaveBeenCalledWith(
    env.granite_v2,
    expect.objectContaining({ id: "webhook_existing" })
  );
});

it("uses the new row id when insert succeeds (first delivery)", async () => {
  vi.mocked(d1.insertWebhookInbox).mockResolvedValueOnce({ inserted: true });
  vi.mocked(graph.fetchMentionedMedia).mockResolvedValueOnce({
    username: "@Climber",
    caption: "@granite.kr #큰바위 #SkyHook",
    mediaUrl: "https://video.cdninstagram.com/abc",
    thumbnailUrl: null,
    permalink: null,
  });
  vi.mocked(d1.findPublishedRouteCandidates).mockResolvedValueOnce([]);

  await processMentionEvent(
    { externalId: "m_new", igUserId: "u1", mediaId: "m_new", commentId: null },
    env,
    "{}"
  );

  // tryReclaim must NOT be called when insert succeeded.
  expect(d1.tryReclaimWebhookForRetry).not.toHaveBeenCalled();
});
```

If `tryReclaimWebhookForRetry` is not yet in the mock factory, add it. Reset all four mocks (`insertWebhookInbox`, `tryReclaimWebhookForRetry`, `setWebhookInboxStatus`, `hydrateWebhookInbox`, `findPublishedRouteCandidates`, `fetchMentionedMedia`) in `beforeEach`.

After completing this step, flip Step 1's checkbox to `[x]` in the plan file.

- [ ] **Step 2: Run the tests and confirm they fail.**

```
pnpm test workers/instagram-webhook/src/match.test.ts
```
Expected: at least the terminal no-op test and the failed-reclaim test fail because `tryReclaimWebhookForRetry` doesn't exist and `processMentionEvent` doesn't branch on insertion result.

Flip Step 2 checkbox.

- [ ] **Step 3: Add `tryReclaimWebhookForRetry` to `workers/instagram-webhook/src/d1.ts`.**

```ts
export async function tryReclaimWebhookForRetry(
  db: D1Database,
  externalId: string
): Promise<{ webhookId: string; currentStatus: string } | null> {
  // Atomically transition any non-terminal row to processing and increment attempt count.
  // Terminal statuses (matched, duplicate, rejected, manual_matched) are NOT touched.
  const updateResult = await db
    .prepare(
      `UPDATE webhook_inbox
       SET status = 'processing',
           processing_attempts = processing_attempts + 1,
           updated_at = datetime('now')
       WHERE external_id = ?
         AND status IN ('received', 'processing', 'failed', 'unmatched')`
    )
    .bind(externalId)
    .run();

  if ((updateResult.meta.changes ?? 0) === 0) {
    return null;
  }

  const row = await db
    .prepare(
      `SELECT id AS webhookId, status AS currentStatus
       FROM webhook_inbox
       WHERE external_id = ?
       LIMIT 1`
    )
    .bind(externalId)
    .first<{ webhookId: string; currentStatus: string }>();

  return row;
}
```

Flip Step 3 checkbox.

- [ ] **Step 4: Replace the early-return idempotency in `workers/instagram-webhook/src/match.ts`.**

Read the current file. Find the existing block (around the top of `processMentionEvent`):

```ts
const webhookId = uuid("webhook");

const inserted = await insertWebhookInbox(env.granite_v2, { ... });

if (!inserted.inserted) {
  return;
}

await setWebhookInboxStatus(env.granite_v2, {
  id: webhookId,
  status: "processing",
  incrementAttempts: true,
});
```

Replace with:

```ts
const newWebhookId = uuid("webhook");

const inserted = await insertWebhookInbox(env.granite_v2, {
  id: newWebhookId,
  externalId: event.externalId,
  externalMediaId: event.mediaId,
  igUserId: event.igUserId,
  igUsername: "",
  caption: "",
  mediaUrl: "",
  thumbnailUrl: null,
  rawPayload,
});

let webhookId: string;
if (inserted.inserted) {
  webhookId = newWebhookId;
  await setWebhookInboxStatus(env.granite_v2, {
    id: webhookId,
    status: "processing",
    incrementAttempts: true,
  });
} else {
  const reclaim = await tryReclaimWebhookForRetry(env.granite_v2, event.externalId);
  if (!reclaim) {
    // Existing row is in a terminal status — true idempotent no-op.
    return;
  }
  webhookId = reclaim.webhookId;
  // tryReclaimWebhookForRetry already set status='processing' + incremented attempts.
}
```

Then keep the rest of the function body unchanged — `webhookId` still names the variable used downstream. Replace any other use of the original `webhookId` declaration if needed so the rest of the function reads the rebound variable.

Add `tryReclaimWebhookForRetry` to the `import { ... } from "./d1";` block.

Flip Step 4 checkbox.

- [ ] **Step 5: Run the tests and confirm they pass.**

```
pnpm test workers/instagram-webhook/src/match.test.ts
```
Expected: all tests (Task 12, 14, and Task 16's 3 new) green.

Flip Step 5 checkbox.

- [ ] **Step 6: Full verification.**

```
pnpm test workers/instagram-webhook
pnpm typecheck
pnpm wrangler deploy --dry-run
```
All three must pass.

Flip Step 6 checkbox.

- [ ] **Step 7: Mark Task 16 step checkboxes complete in this plan file.**

Verify Steps 1–6 are `[x]`. Flip Step 7 itself to `[x]`.

- [ ] **Step 8: Commit.**

```bash
git add workers/instagram-webhook/src/d1.ts workers/instagram-webhook/src/match.ts workers/instagram-webhook/src/match.test.ts docs/plans/2026-06-02-granite-phase-5.md
git commit -m "fix(webhook): state-aware idempotency for Meta redelivery of non-terminal rows"
```

After commit, flip Step 8 and follow up:

```bash
git add docs/plans/2026-06-02-granite-phase-5.md
git commit -m "docs(phase5): mark Task 16 Step 8 complete"
```

---

## Task 17: Reject Manual Match for Rows Without a Canonical Media ID

**Codex finding addressed:** Migration 0005 added `webhook_inbox.external_media_id` but did NOT backfill it for pre-existing rows. `manualMatchWebhookToRoute` then falls back to `external_id` when `external_media_id IS NULL`. For caption mentions this is harmless (the two values are equal). For COMMENT mentions, `external_id` is the comment_id — using it as the canonical media id misses real duplicates (an auto-matched Beta keyed by `media_id` and a legacy-comment manual match keyed by `comment_id` coexist), and poisons the `external_media_id` uniqueness key.

Two viable fixes:
- **Option A** — 0006 backfill migration parsing `raw_payload` JSON via SQLite's `json_extract`.
- **Option C (chosen)** — at manual-match time, fall back to parsing `media_id` from the row's `raw_payload`. Refuse the match if parsing fails (new outcome `needs_rehydration`). Lower migration risk, deterministic, and the raw payload is already retained.

If parsing fails or the payload lacks a `media_id`, manual match is refused and the row is left visible to the operator with `last_error_code='needs_rehydration'` so they can investigate or reject. No new migration.

**Files:**
- Modify: `lib/db/beta-queries.ts` (raw_payload fallback + new outcome)
- Modify: `lib/db/beta-queries.test.ts` (2 new tests)
- Modify: `lib/actions/admin-beta.ts` (handle `needs_rehydration` outcome in audit log)
- Modify: `docs/admin-beta-operations.md` (operator SOP entry for the new error code)
- Modify: `docs/plans/2026-06-02-granite-phase-5.md` (checkboxes)

- [ ] **Step 1: Write failing tests for the raw_payload fallback path.**

Open `lib/db/beta-queries.test.ts`. Inside the existing `describe("manualMatchWebhookToRoute", ...)` block, append:

```ts
it("uses media_id parsed from raw_payload when external_media_id is null (legacy comment mention)", async () => {
  vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });
  const legacyRawPayload = JSON.stringify({
    entry: [
      {
        id: "ig_user_1",
        changes: [
          {
            field: "mentions",
            value: { media_id: "media_from_payload", comment_id: "comment_1" },
          },
        ],
      },
    ],
  });
  vi.mocked(queryD1)
    .mockResolvedValueOnce([
      {
        igUsername: "climber",
        caption: "@granite.kr #큰바위 #SkyHook",
        mediaUrl: "https://www.instagram.com/p/abc/",
        externalId: "comment_1",
        externalMediaId: null, // legacy: not backfilled
        rawPayload: legacyRawPayload,
      },
    ]) // SELECT row
    .mockResolvedValueOnce([]) // INSERT betas
    .mockResolvedValueOnce([]); // finalize UPDATE
  vi.mocked(queryD1First).mockResolvedValueOnce(null); // findExistingBetaByExternalMedia

  const { manualMatchWebhookToRoute } = await import("./beta-queries");

  const outcome = await manualMatchWebhookToRoute({
    webhookId: "webhook_1",
    routeId: "route_1",
    betaId: "beta_new",
  });

  expect(outcome).toEqual({ ok: true, betaId: "beta_new" });
  const insertCall = vi
    .mocked(queryD1)
    .mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO betas")
    );
  expect(insertCall?.[1]).toContain("media_from_payload"); // canonical, parsed from raw_payload
  expect(insertCall?.[1]).not.toContain("comment_1"); // NOT the external_id (comment_id) fallback
});

it("refuses manual match and surfaces needs_rehydration when raw_payload has no media_id", async () => {
  vi.mocked(executeD1Meta).mockResolvedValue({ changes: 1 });
  vi.mocked(queryD1)
    .mockResolvedValueOnce([
      {
        igUsername: "climber",
        caption: "",
        mediaUrl: "",
        externalId: "comment_only",
        externalMediaId: null,
        rawPayload: "{}", // malformed / no media_id
      },
    ]) // SELECT row
    .mockResolvedValueOnce([]); // revert UPDATE

  const { manualMatchWebhookToRoute } = await import("./beta-queries");

  const outcome = await manualMatchWebhookToRoute({
    webhookId: "webhook_1",
    routeId: "route_1",
    betaId: "beta_new",
  });

  expect(outcome).toEqual({ ok: false, reason: "needs_rehydration" });

  const revertCall = vi
    .mocked(queryD1)
    .mock.calls.find(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("UPDATE webhook_inbox") &&
        c[0].includes("status = 'unmatched'") &&
        c[0].includes("needs_rehydration")
    );
  expect(revertCall).toBeDefined();
});
```

Update the SELECT mock for the EXISTING happy-path and partial-failure tests to also return `rawPayload` (you'll be adding it to the actual SELECT in Step 3). The simplest update: add `rawPayload: "{}"` (or a representative JSON string) to every existing mocked row.

Flip Step 1 checkbox.

- [ ] **Step 2: Run tests, confirm the two new tests fail.**

```
pnpm test lib/db/beta-queries.test.ts
```
Expected: the two new tests fail.

Flip Step 2 checkbox.

- [ ] **Step 3: Update `manualMatchWebhookToRoute` in `lib/db/beta-queries.ts`.**

Three edits to the existing function:

(a) Extend `ManualMatchOutcome`:

```ts
export type ManualMatchOutcome =
  | { ok: true; betaId: string }
  | { ok: false; reason: "not_unmatched" }
  | { ok: false; reason: "duplicate"; existingBetaId: string }
  | { ok: false; reason: "needs_rehydration" };
```

(b) Add a top-level helper just below the type definition (in the same file):

```ts
function extractMediaIdFromRawPayload(rawPayload: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const root = parsed as Record<string, unknown>;
  const entry = root.entry;
  if (!Array.isArray(entry) || entry.length === 0) return null;
  const e0 = entry[0];
  if (typeof e0 !== "object" || e0 === null) return null;
  const changes = (e0 as Record<string, unknown>).changes;
  if (!Array.isArray(changes) || changes.length === 0) return null;
  const c0 = changes[0];
  if (typeof c0 !== "object" || c0 === null) return null;
  const value = (c0 as Record<string, unknown>).value;
  if (typeof value !== "object" || value === null) return null;
  const mediaId = (value as Record<string, unknown>).media_id;
  return typeof mediaId === "string" && mediaId.length > 0 ? mediaId : null;
}
```

(c) In `manualMatchWebhookToRoute`, update the SELECT to fetch `raw_payload`, and replace the existing `canonicalMediaId` derivation with the new fallback logic. The relevant changes:

```ts
const rows = await queryD1<{
  igUsername: string;
  caption: string;
  mediaUrl: string;
  externalId: string;
  externalMediaId: string | null;
  rawPayload: string;
}>(
  `SELECT
     ig_username AS igUsername,
     caption,
     media_url AS mediaUrl,
     external_id AS externalId,
     external_media_id AS externalMediaId,
     raw_payload AS rawPayload
   FROM webhook_inbox
   WHERE id = ?
   LIMIT 1`,
  [input.webhookId]
);
```

Replace the existing `const canonicalMediaId = row.externalMediaId ?? row.externalId;` block with:

```ts
let canonicalMediaId: string | null = row.externalMediaId;
if (!canonicalMediaId) {
  canonicalMediaId = extractMediaIdFromRawPayload(row.rawPayload);
}
if (!canonicalMediaId) {
  // Cannot safely identify the Instagram media. Refuse the match and surface
  // the state so an operator can decide between rehydration or rejection.
  await queryD1(
    `UPDATE webhook_inbox
     SET status = 'unmatched',
         last_error_code = 'needs_rehydration',
         last_error_message = 'raw_payload missing entry[0].changes[0].value.media_id',
         updated_at = datetime('now')
     WHERE id = ?`,
    [input.webhookId]
  );
  return { ok: false, reason: "needs_rehydration" };
}
```

Keep the existing duplicate check, INSERT, and finalize logic — they now use the safer `canonicalMediaId`.

Flip Step 3 checkbox.

- [ ] **Step 4: Run tests, confirm pass.**

```
pnpm test lib/db/beta-queries.test.ts
```
Expected: all `manualMatchWebhookToRoute` tests pass, including the two new fallback cases.

Flip Step 4 checkbox.

- [ ] **Step 5: Update `manualMatchWebhookAction` in `lib/actions/admin-beta.ts` to record the new outcome.**

Locate the existing skipped-outcome audit log block. Extend the `metadata` conditional to record `needs_rehydration`:

```ts
await insertAdminAuditLog({
  adminId: admin.adminId,
  action: "webhook.manual_match_skipped",
  targetType: "webhook_inbox",
  targetId: parsed.webhookId,
  metadata:
    result.reason === "duplicate"
      ? { routeId: parsed.routeId, reason: "duplicate", existingBetaId: result.existingBetaId }
      : result.reason === "needs_rehydration"
      ? { routeId: parsed.routeId, reason: "needs_rehydration" }
      : { routeId: parsed.routeId, reason: result.reason },
});
revalidatePath("/admin/webhooks");
```

No new UI is added in this task — operators will see the row reappear as `unmatched` with `last_error_code='needs_rehydration'` via the existing webhook table.

Flip Step 5 checkbox.

- [ ] **Step 6: Add SOP entry to `docs/admin-beta-operations.md`.**

Find the "운영 이벤트 오류 코드 가이드" / operational error code section. Add an entry for `needs_rehydration`:

```
- `needs_rehydration` — 수동 매칭 대상 행에 `external_media_id`가 비어 있고 `raw_payload`에서 `media_id`를 추출할 수 없는 경우. 마이그레이션 0005 이전에 들어온 댓글 멘션 행에서 발생 가능. 운영자 대응: (a) Meta App Dashboard에서 동일 이벤트를 재배달하여 hydration 경로를 재실행하거나 (b) 거절 후 사용자에게 수동 등록 폼 안내.
```

Adjust the exact wording to match the existing list style.

Flip Step 6 checkbox.

- [ ] **Step 7: Full verification.**

```
pnpm test lib/db/beta-queries.test.ts
pnpm test lib/actions/admin-beta.test.ts
pnpm typecheck
pnpm build
```
All must pass.

Flip Step 7 checkbox.

- [ ] **Step 8: Mark Task 17 step checkboxes complete in this plan file.**

Verify Steps 1–7 are `[x]`. Flip Step 8 itself to `[x]`.

- [ ] **Step 9: Commit.**

```bash
git add lib/db/beta-queries.ts lib/db/beta-queries.test.ts lib/actions/admin-beta.ts docs/admin-beta-operations.md docs/plans/2026-06-02-granite-phase-5.md
git commit -m "fix(webhook): refuse manual match without canonical media id (legacy comment mentions)"
```

After commit, follow up:

```bash
git add docs/plans/2026-06-02-granite-phase-5.md
git commit -m "docs(phase5): mark Task 17 Step 9 complete"
```

---

## Self-Review

- **Spec coverage:** Covers PRD P5-01 through P5-08: caption UI, Worker webhook, inbox persistence, matching, unclaimed Beta creation, admin inbox, Beta moderation, manual registration, and thumbnail fallback. Codex adversarial review iterations 1–3 added Tasks 12–17 to close concrete recoverability and integrity gaps: (12) `processMentionEvent` async exceptions stranded `processing` rows; (13) `manualMatchWebhookToRoute` was non-atomic and used the wrong identifier for comment mentions; (14) `webhook_inbox` was never hydrated with the Graph API response; (15) `manualMatchWebhookToRoute` had no compensating action for INSERT/finalize partial failures; (16) `INSERT OR IGNORE` early-return made Meta dashboard redelivery a silent no-op for failed/processing/unmatched rows; (17) `external_media_id` fallback to `external_id` was unsafe for legacy comment-mention rows.
- **Excluded intentionally:** OAuth, my records, projects, and unclaimed claims remain Phase 6. Scheduled retry, manual-submission rate limit, moderation SLA, and webhook admin notification channel are also explicitly out of scope (see Out Of Scope and Future Work).
- **Risk areas:** Meta payload shape and permission review may require adjustment after the real app callback is approved. Worker D1/R2 binding names (`granite_v2`, `BUCKET`) must remain aligned with the production Cloudflare project before deploy. D1 HTTP API lacks true transactions; Task 13's claim/insert sequence reduces but cannot fully eliminate the race window — acceptable because manual matching is admin-gated and operationally infrequent.
- **Verification:** Each implementation task has a focused Vitest/typecheck/build or manual QA gate. Tasks 1–11 are implemented and committed on `phase5-implementation` (commits `fbb07da` through `d29ea51`, 370 tests passing). Tasks 12–13 are pending implementation. Final release requires Meta app review and production HMAC verification (Task 11 Step 5 manual QA, deferred to launch).
