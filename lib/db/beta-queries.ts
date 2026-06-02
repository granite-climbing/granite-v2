import { queryD1, queryD1First, executeD1Meta } from "./d1-http";
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
  moderationNote: string;
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
  processingAttempts: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
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
       be.moderation_note AS moderationNote,
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
       processing_attempts AS processingAttempts,
       last_error_code AS lastErrorCode,
       last_error_message AS lastErrorMessage,
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

// ---------------------------------------------------------------------------
// Duplicate handling helpers
// ---------------------------------------------------------------------------

export type ExistingBetaRef = { id: string; status: BetaStatus };

export async function findExistingBetaByExternalMedia(
  platform: BetaPlatform,
  externalMediaId: string
): Promise<ExistingBetaRef | null> {
  return queryD1First<ExistingBetaRef>(
    `SELECT id, status FROM betas
     WHERE platform = ? AND external_media_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [platform, externalMediaId]
  );
}

export async function findExistingBetaByPermalink(
  platform: BetaPlatform,
  permalinkUrl: string
): Promise<ExistingBetaRef | null> {
  return queryD1First<ExistingBetaRef>(
    `SELECT id, status FROM betas
     WHERE platform = ? AND permalink_url = ? AND deleted_at IS NULL
     LIMIT 1`,
    [platform, permalinkUrl]
  );
}

export async function markWebhookDuplicate(input: {
  webhookId: string;
  matchedBetaId: string;
}): Promise<void> {
  await queryD1(
    `UPDATE webhook_inbox SET
       status = 'duplicate',
       matched_beta_id = ?,
       last_error_code = 'duplicate_beta',
       updated_at = datetime('now')
     WHERE id = ?`,
    [input.matchedBetaId, input.webhookId]
  );
}

// ---------------------------------------------------------------------------
// Operational event helpers
// ---------------------------------------------------------------------------

export type WebhookOperationalEventInput = {
  id: string;
  eventType:
    | "invalid_signature"
    | "graph_api_failure"
    | "caption_parse_failed"
    | "route_match_ambiguous"
    | "duplicate_beta"
    | "thumbnail_lookup_failed"
    | "thumbnail_copy_failed";
  webhookId: string | null;
  betaId: string | null;
  requestId: string;
  method: string;
  path: string;
  statusCode: number | null;
  message: string;
  metadata: string; // JSON-encoded string
};

export async function insertWebhookOperationalEvent(
  input: WebhookOperationalEventInput
): Promise<void> {
  await queryD1(
    `INSERT INTO webhook_operational_events (
       id, event_type, provider, webhook_id, beta_id, request_id,
       method, path, status_code, message, metadata
     ) VALUES (?, ?, 'instagram', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.eventType,
      input.webhookId,
      input.betaId,
      input.requestId,
      input.method,
      input.path,
      input.statusCode,
      input.message,
      input.metadata,
    ]
  );
}

export type AdminWebhookOperationalEventRow = {
  id: string;
  eventType: string;
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

export async function getRecentWebhookOperationalEvents(
  limit: number
): Promise<AdminWebhookOperationalEventRow[]> {
  return queryD1<AdminWebhookOperationalEventRow>(
    `SELECT
       id,
       event_type AS eventType,
       webhook_id AS webhookId,
       beta_id AS betaId,
       request_id AS requestId,
       method,
       path,
       status_code AS statusCode,
       message,
       metadata,
       created_at AS createdAt
     FROM webhook_operational_events
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function updateBetaThumbnailUrl(id: string, thumbnailUrl: string): Promise<void> {
  await queryD1(
    `UPDATE betas SET thumbnail_url = ?, updated_at = datetime('now') WHERE id = ?`,
    [thumbnailUrl, id]
  );
}

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
    // Defensive: revert if the row somehow vanished.
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

  // 4) Insert the Beta with the canonical media id.
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
