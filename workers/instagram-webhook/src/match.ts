import type { Env } from "./index";
import type { MentionEvent } from "./payload";
import {
  findExistingBetaByExternalMedia,
  findPublishedRouteCandidates,
  hydrateWebhookInbox,
  insertWebhookBeta,
  insertWebhookInbox,
  insertWebhookOperationalEvent,
  setWebhookInboxStatus,
  tryReclaimWebhookForRetry,
} from "./d1";
import { fetchMentionedComment, fetchMentionedMedia } from "./graph-api";
import { extractHashtags, normalizeHandle, normalizeToken } from "./normalize";
import { attemptThumbnailCopy } from "./thumbnail";

function uuid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function processMentionEvent(
  event: MentionEvent,
  env: Env,
  rawPayload: string
): Promise<void> {
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
  let leaseAttempts: number;

  if (inserted.inserted) {
    webhookId = newWebhookId;
    const claimResult = await setWebhookInboxStatus(env.granite_v2, {
      id: webhookId,
      status: "processing",
      incrementAttempts: true,
      expectedStatus: "received",
    });
    if (claimResult.changes === 0) {
      // Defensive: someone else already moved this row. Stop.
      return;
    }
    leaseAttempts = 1;
  } else {
    const reclaim = await tryReclaimWebhookForRetry(env.granite_v2, event.externalId);
    if (!reclaim) {
      // Existing row is in a terminal status or still fresh processing — true idempotent no-op.
      return;
    }
    webhookId = reclaim.webhookId;
    leaseAttempts = reclaim.attempts;
  }

  let createdBetaId: string | null = null;

  try {
  let captionText = "";
  if (event.commentId) {
    const comment = await fetchMentionedComment({
      igUserId: event.igUserId,
      commentId: event.commentId,
      accessToken: env.INSTAGRAM_GRAPH_ACCESS_TOKEN,
    });
    if (!comment) {
      const r = await setWebhookInboxStatus(env.granite_v2, {
        id: webhookId,
        status: "failed",
        lastErrorCode: "graph_api_failure",
        lastErrorMessage: "mentioned_comment fetch failed",
        expectedAttempts: leaseAttempts,
      });
      if (r.changes === 0) return;
      await insertWebhookOperationalEvent(env.granite_v2, {
        id: uuid("opev"),
        eventType: "graph_api_failure",
        webhookId,
        betaId: null,
        requestId: "",
        method: "GET",
        path: "/mentioned_comment",
        statusCode: null,
        message: "mentioned_comment fetch failed",
        metadata: "{}",
      });
      return;
    }
    captionText = comment.text;
  }

  const media = await fetchMentionedMedia({
    igUserId: event.igUserId,
    mediaId: event.mediaId,
    accessToken: env.INSTAGRAM_GRAPH_ACCESS_TOKEN,
  });
  if (!media) {
    const r = await setWebhookInboxStatus(env.granite_v2, {
      id: webhookId,
      status: "failed",
      lastErrorCode: "graph_api_failure",
      lastErrorMessage: "mentioned_media fetch failed",
      expectedAttempts: leaseAttempts,
    });
    if (r.changes === 0) return;
    await insertWebhookOperationalEvent(env.granite_v2, {
      id: uuid("opev"),
      eventType: "graph_api_failure",
      webhookId,
      betaId: null,
      requestId: "",
      method: "GET",
      path: "/mentioned_media",
      statusCode: null,
      message: "mentioned_media fetch failed",
      metadata: "{}",
    });
    return;
  }

  if (!captionText) captionText = media.caption;
  const igUsername = normalizeHandle(media.username);

  await hydrateWebhookInbox(env.granite_v2, {
    id: webhookId,
    igUsername,
    caption: captionText,
    mediaUrl: media.mediaUrl ?? media.permalink ?? "",
    permalinkUrl: media.permalink,
    thumbnailUrl: media.thumbnailUrl,
  });

  // Duplicate check
  const existing = await findExistingBetaByExternalMedia(env.granite_v2, event.mediaId);
  if (existing) {
    const r = await setWebhookInboxStatus(env.granite_v2, {
      id: webhookId,
      status: "duplicate",
      matchedBetaId: existing.id,
      lastErrorCode: "duplicate_beta",
      expectedAttempts: leaseAttempts,
    });
    if (r.changes === 0) return;
    await insertWebhookOperationalEvent(env.granite_v2, {
      id: uuid("opev"),
      eventType: "duplicate_beta",
      webhookId,
      betaId: existing.id,
      requestId: "",
      method: "POST",
      path: "/webhooks/instagram",
      statusCode: null,
      message: "duplicate media id",
      metadata: JSON.stringify({ mediaId: event.mediaId }),
    });
    return;
  }

  // Hashtag-based route matching
  const captionTokens = new Set(extractHashtags(captionText));
  if (captionTokens.size === 0) {
    const r = await setWebhookInboxStatus(env.granite_v2, {
      id: webhookId,
      status: "unmatched",
      lastErrorCode: "caption_parse_failed",
      expectedAttempts: leaseAttempts,
    });
    if (r.changes === 0) return;
    return;
  }

  const candidates = await findPublishedRouteCandidates(env.granite_v2);
  const matches = candidates.filter((c) => {
    const boulderToken = normalizeToken(c.boulderName);
    const routeToken = normalizeToken(c.routeName);
    return captionTokens.has(boulderToken) && captionTokens.has(routeToken);
  });

  if (matches.length !== 1) {
    const r = await setWebhookInboxStatus(env.granite_v2, {
      id: webhookId,
      status: "unmatched",
      lastErrorCode: matches.length > 1 ? "route_match_ambiguous" : "",
      expectedAttempts: leaseAttempts,
    });
    if (r.changes === 0) return;
    if (matches.length > 1) {
      await insertWebhookOperationalEvent(env.granite_v2, {
        id: uuid("opev"),
        eventType: "route_match_ambiguous",
        webhookId,
        betaId: null,
        requestId: "",
        method: "POST",
        path: "/webhooks/instagram",
        statusCode: null,
        message: `${matches.length} candidates matched`,
        metadata: JSON.stringify({ candidateIds: matches.map((m) => m.routeId) }),
      });
    }
    return;
  }

  const route = matches[0];
  createdBetaId = uuid("beta");
  await insertWebhookBeta(env.granite_v2, {
    id: createdBetaId,
    routeId: route.routeId,
    instagramId: igUsername,
    displayName: igUsername,
    mediaUrl: media.mediaUrl ?? media.permalink ?? "",
    permalinkUrl: media.permalink,
    externalMediaId: event.mediaId,
    sentAt: new Date().toISOString().slice(0, 10),
  });

  const matchResult = await setWebhookInboxStatus(env.granite_v2, {
    id: webhookId,
    status: "matched",
    matchedBetaId: createdBetaId,
    expectedAttempts: leaseAttempts,
  });
  if (matchResult.changes === 0) {
    return;
  }

  // Thumbnail copy
  const cdnUrl = await attemptThumbnailCopy(env.BUCKET, env.CDN_BASE_URL, createdBetaId, media);
  if (cdnUrl) {
    await env.granite_v2
      .prepare(`UPDATE betas SET thumbnail_url = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(cdnUrl, createdBetaId)
      .run();
  } else {
    // Thumbnail copy failed; primary status (matched) stays.
    await env.granite_v2
      .prepare(`UPDATE webhook_inbox SET last_error_code = 'thumbnail_copy_failed', last_error_message = 'thumbnail download or R2 upload failed', updated_at = datetime('now') WHERE id = ?`)
      .bind(webhookId)
      .run();
    await insertWebhookOperationalEvent(env.granite_v2, {
      id: uuid("opev"),
      eventType: "thumbnail_copy_failed",
      webhookId,
      betaId: createdBetaId,
      requestId: "",
      method: "POST",
      path: "/webhooks/instagram",
      statusCode: null,
      message: "thumbnail download or R2 upload failed",
      metadata: "{}",
    });
  }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      if (createdBetaId !== null) {
        // Best-effort: try one more time to link the inbox. If this also fails,
        // the operational event below preserves enough context for an operator.
        try {
          await setWebhookInboxStatus(env.granite_v2, {
            id: webhookId,
            status: "matched",
            matchedBetaId: createdBetaId,
            expectedStatus: "processing",
          });
        } catch {
          // proceed with orphan logging
        }
      }
      await setWebhookInboxStatus(env.granite_v2, {
        id: webhookId,
        status: "failed",
        lastErrorCode: "graph_api_exception",
        lastErrorMessage: message.slice(0, 500),
        expectedStatus: "processing",
      });
      await insertWebhookOperationalEvent(env.granite_v2, {
        id: uuid("opev"),
        eventType: "graph_api_failure",
        webhookId,
        betaId: createdBetaId,
        requestId: "",
        method: "POST",
        path: "/webhooks/instagram",
        statusCode: null,
        message: createdBetaId
          ? `processMentionEvent threw after beta insert: ${message}`
          : `processMentionEvent threw: ${message}`,
        metadata: createdBetaId
          ? JSON.stringify({ kind: "orphan_beta_auto_match", reason: message })
          : "{}",
      });
    } catch (recoveryError) {
      console.error("processMentionEvent recovery failed:", recoveryError);
    }
  }
}
