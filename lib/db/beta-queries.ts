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
  externalMediaId: string | null;
  igUsername: string;
  caption: string;
  mediaUrl: string;
  permalinkUrl: string | null;
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

export async function findPublishedRouteIdForBeta(routeId: string): Promise<{ id: string } | null> {
  return queryD1First<{ id: string }>(
    `SELECT r.id AS id
     FROM routes r
     JOIN topos t ON t.id = r.topo_id
     JOIN boulders b ON b.id = t.boulder_id
     JOIN sectors s ON s.id = b.sector_id
     JOIN crags c ON c.id = s.crag_id
     JOIN areas a ON a.id = c.area_id
     WHERE r.id = ?
       AND r.is_published = 1 AND t.is_published = 1 AND b.is_published = 1
       AND s.is_published = 1 AND c.is_published = 1 AND a.is_published = 1
       AND r.deleted_at IS NULL AND t.deleted_at IS NULL AND b.deleted_at IS NULL
       AND s.deleted_at IS NULL AND c.deleted_at IS NULL AND a.deleted_at IS NULL
     LIMIT 1`,
    [routeId]
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
       external_media_id AS externalMediaId,
       ig_username AS igUsername,
       caption,
       media_url AS mediaUrl,
       permalink_url AS permalinkUrl,
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

export type OrphanAutoMatchRow = {
  webhookId: string;
  externalId: string;
  igUsername: string;
  caption: string;
  receivedAt: string;
  betaId: string;
  betaEventCreatedAt: string;
};

export async function getOrphanedAutoMatches(): Promise<OrphanAutoMatchRow[]> {
  return queryD1<OrphanAutoMatchRow>(
    `SELECT
       wi.id AS webhookId,
       wi.external_id AS externalId,
       wi.ig_username AS igUsername,
       wi.caption,
       wi.received_at AS receivedAt,
       ev.beta_id AS betaId,
       ev.created_at AS betaEventCreatedAt
     FROM webhook_inbox wi
     JOIN webhook_operational_events ev ON ev.webhook_id = wi.id
     WHERE wi.status = 'failed'
       AND wi.matched_beta_id IS NULL
       AND ev.beta_id IS NOT NULL
       AND ev.metadata LIKE '%orphan_beta_auto_match%'
     ORDER BY ev.created_at DESC`,
    []
  );
}

export type ManualMatchOutcome =
  | { ok: true; betaId: string }
  | { ok: false; reason: "not_unmatched" }
  | { ok: false; reason: "duplicate"; existingBetaId: string }
  | { ok: false; reason: "needs_rehydration" }
  | { ok: false; reason: "route_not_published" };

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
  if (rows.length === 0) {
    // Defensive: revert if the row somehow vanished.
    await queryD1(
      `UPDATE webhook_inbox SET status = 'unmatched', updated_at = datetime('now') WHERE id = ?`,
      [input.webhookId]
    );
    return { ok: false, reason: "not_unmatched" };
  }
  const row = rows[0];

  // 3) Canonical media id dedup. New rows have external_media_id; legacy comment-mention rows
  //    may have it NULL (pre-migration-0005). Parse from raw_payload as a safe fallback.
  //    If we still cannot resolve a canonical media id, refuse the match so we don't poison
  //    the uniqueness key with a comment_id.
  let canonicalMediaId: string | null = row.externalMediaId;
  if (!canonicalMediaId) {
    canonicalMediaId = extractMediaIdFromRawPayload(row.rawPayload);
  }
  if (!canonicalMediaId) {
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
  // 3b) Validate that the target route is published and all ancestors are published/non-deleted.
  const publishedRoute = await findPublishedRouteIdForBeta(input.routeId);
  if (!publishedRoute) {
    // Release the claim so the operator can re-pick a valid route.
    await queryD1(
      `UPDATE webhook_inbox
       SET status = 'unmatched',
           last_error_code = 'route_not_published',
           last_error_message = 'selected route is not published or has been deleted',
           updated_at = datetime('now')
       WHERE id = ?`,
      [input.webhookId]
    );
    return { ok: false, reason: "route_not_published" };
  }

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
    // The Beta exists but the inbox can't be back-linked. Log as orphan and rethrow.
    try {
      await insertWebhookOperationalEvent({
        id: `opev_${crypto.randomUUID()}`,
        eventType: "duplicate_beta", // closest existing event_type; metadata.kind distinguishes orphan
        webhookId: input.webhookId,
        betaId: input.betaId,
        requestId: "",
        method: "POST",
        path: "/admin/webhooks/manual-match",
        statusCode: null,
        message: "manual match finalize failed; beta orphaned (inbox missing matched_beta_id)",
        metadata: JSON.stringify({
          kind: "orphan_beta",
          reason: finalizeError instanceof Error ? finalizeError.message : "unknown",
        }),
      });
    } catch {
      // Best-effort: do not lose the original error if the op-event insert also fails.
    }
    throw finalizeError;
  }

  return { ok: true, betaId: input.betaId };
}
