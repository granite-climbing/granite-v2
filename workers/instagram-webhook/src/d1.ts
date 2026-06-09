export type RouteCandidate = {
  routeId: string;
  routeName: string;
  boulderName: string;
  boulderHashtags: string;
};

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

export async function setWebhookInboxStatus(
  db: D1Database,
  input: {
    id: string;
    status:
      | "received"
      | "processing"
      | "matched"
      | "unmatched"
      | "manual_matched"
      | "rejected"
      | "duplicate"
      | "failed";
    matchedBetaId?: string | null;
    lastErrorCode?: string;
    lastErrorMessage?: string;
    incrementAttempts?: boolean;
    expectedStatus?: string;
    expectedAttempts?: number;
  }
): Promise<{ changes: number }> {
  let whereClause = `id = ?`;
  const guardParams: unknown[] = [];
  if (input.expectedStatus !== undefined) {
    whereClause += ` AND status = ?`;
    guardParams.push(input.expectedStatus);
  }
  if (input.expectedAttempts !== undefined) {
    whereClause += ` AND processing_attempts = ?`;
    guardParams.push(input.expectedAttempts);
  }

  const result = await db
    .prepare(
      `UPDATE webhook_inbox SET
         status = ?,
         matched_beta_id = COALESCE(?, matched_beta_id),
         last_error_code = COALESCE(?, last_error_code),
         last_error_message = COALESCE(?, last_error_message),
         processing_attempts = processing_attempts + ?,
         updated_at = datetime('now')
       WHERE ${whereClause}`
    )
    .bind(
      input.status,
      input.matchedBetaId ?? null,
      input.lastErrorCode ?? null,
      input.lastErrorMessage ?? null,
      input.incrementAttempts ? 1 : 0,
      input.id,
      ...guardParams
    )
    .run();
  return { changes: result.meta.changes ?? 0 };
}

export async function insertWebhookBeta(
  db: D1Database,
  input: {
    id: string;
    routeId: string;
    instagramId: string;
    displayName: string;
    mediaUrl: string;
    permalinkUrl: string | null;
    externalMediaId: string;
    sentAt: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO betas (
         id, route_id, user_id, instagram_id, display_name, source, platform,
         media_url, permalink_url, external_media_id, thumbnail_url, sent_at, status, claim_status
       ) VALUES (?, ?, NULL, ?, ?, 'instagram_webhook', 'instagram', ?, ?, ?, NULL, ?, 'pending', 'unclaimed')`
    )
    .bind(
      input.id,
      input.routeId,
      input.instagramId,
      input.displayName,
      input.mediaUrl,
      input.permalinkUrl,
      input.externalMediaId,
      input.sentAt
    )
    .run();
}

export async function findExistingBetaByExternalMedia(
  db: D1Database,
  externalMediaId: string
): Promise<{ id: string } | null> {
  return db
    .prepare(
      `SELECT id FROM betas
       WHERE platform = 'instagram' AND external_media_id = ? AND deleted_at IS NULL
       LIMIT 1`
    )
    .bind(externalMediaId)
    .first<{ id: string }>();
}

export async function findPublishedRouteCandidates(db: D1Database): Promise<RouteCandidate[]> {
  const result = await db
    .prepare(
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
       WHERE r.is_published = 1 AND t.is_published = 1 AND b.is_published = 1
         AND s.is_published = 1 AND c.is_published = 1 AND a.is_published = 1
         AND r.deleted_at IS NULL AND t.deleted_at IS NULL AND b.deleted_at IS NULL
         AND s.deleted_at IS NULL AND c.deleted_at IS NULL AND a.deleted_at IS NULL`
    )
    .all<RouteCandidate>();
  return result.results;
}

// permalinkUrl is accepted but not persisted — webhook_inbox has no permalink_url column today.
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

export async function tryReclaimWebhookForRetry(
  db: D1Database,
  externalId: string
): Promise<{ webhookId: string; currentStatus: string; attempts: number } | null> {
  const updateResult = await db
    .prepare(
      `UPDATE webhook_inbox
       SET status = 'processing',
           processing_attempts = processing_attempts + 1,
           updated_at = datetime('now')
       WHERE external_id = ?
         AND (
           status IN ('received', 'failed', 'unmatched')
           OR (status = 'processing' AND updated_at < datetime('now', '-5 minutes'))
         )`
    )
    .bind(externalId)
    .run();

  if ((updateResult.meta.changes ?? 0) === 0) {
    return null;
  }

  const row = await db
    .prepare(
      `SELECT id AS webhookId, status AS currentStatus, processing_attempts AS attempts
       FROM webhook_inbox
       WHERE external_id = ?
       LIMIT 1`
    )
    .bind(externalId)
    .first<{ webhookId: string; currentStatus: string; attempts: number }>();

  return row;
}

export async function insertWebhookOperationalEvent(
  db: D1Database,
  input: {
    id: string;
    eventType:
      | "invalid_signature"
      | "invalid_payload"
      | "no_mention_events"
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
    metadata: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO webhook_operational_events (
         id, event_type, provider, webhook_id, beta_id,
         request_id, method, path, status_code, message, metadata
       ) VALUES (?, ?, 'instagram', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.id,
      input.eventType,
      input.webhookId,
      input.betaId,
      input.requestId,
      input.method,
      input.path,
      input.statusCode,
      input.message,
      input.metadata
    )
    .run();
}

