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
import { fetchMentionedMedia } from "./graph-api";
import { extractHashtags, normalizeHandle, normalizeToken } from "./normalize";
import { attemptThumbnailCopy } from "./thumbnail";

function uuid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function logStep(
  step: string,
  ctx: Record<string, unknown>
): void {
  console.log(`[match] ${step} ${JSON.stringify(ctx)}`);
}

export async function processMentionEvent(
  event: MentionEvent,
  env: Env,
  rawPayload: string
): Promise<void> {
  const newWebhookId = uuid("webhook");
  logStep("01.enter", {
    externalId: event.externalId,
    mediaId: event.mediaId,
    entryId: event.entryId,
    igUserId: event.igUserId,
    igUsername: event.igUsername,
    commentId: event.commentId ?? null,
    newWebhookId,
  });

  const inserted = await insertWebhookInbox(env.granite_v2, {
    id: newWebhookId,
    externalId: event.externalId,
    externalMediaId: event.mediaId,
    igUserId: event.igUserId ?? "",
    igUsername: event.igUsername ?? "",
    caption: "",
    mediaUrl: "",
    thumbnailUrl: null,
    rawPayload,
  });

  let webhookId: string;
  let leaseAttempts: number;

  logStep("02.inbox_insert", {
    externalId: event.externalId,
    inserted: inserted.inserted,
  });

  if (inserted.inserted) {
    webhookId = newWebhookId;
    const claimResult = await setWebhookInboxStatus(env.granite_v2, {
      id: webhookId,
      status: "processing",
      incrementAttempts: true,
      expectedStatus: "received",
    });
    if (claimResult.changes === 0) {
      logStep("02b.claim_lost", { webhookId, externalId: event.externalId });
      return;
    }
    leaseAttempts = 1;
    logStep("03.claimed_fresh", { webhookId, leaseAttempts });
  } else {
    const reclaim = await tryReclaimWebhookForRetry(env.granite_v2, event.externalId);
    if (!reclaim) {
      logStep("02c.idempotent_noop", { externalId: event.externalId });
      return;
    }
    webhookId = reclaim.webhookId;
    leaseAttempts = reclaim.attempts;
    logStep("03.reclaimed", { webhookId, leaseAttempts });
  }

  let createdBetaId: string | null = null;

  try {
  // For `comments`-field webhooks the comment body arrives inline — no extra
  // Graph API hop needed. For `mentions`-field webhooks we fall back to the
  // media caption fetched below.
  let captionText = event.commentText ?? "";
  logStep("04.caption_source", {
    webhookId,
    source: event.commentText ? "payload_inline" : "media_caption",
    captionLen: captionText.length,
  });

  logStep("05.fetch_media.start", { webhookId, mediaId: event.mediaId });
  const media = await fetchMentionedMedia({
    businessAccountId: event.entryId,
    mediaId: event.mediaId,
    accessToken: env.META_PAGE_ACCESS_TOKEN,
  });
  logStep("05.fetch_media.done", {
    webhookId,
    ok: !!media,
    hasMediaUrl: !!media?.mediaUrl,
    hasPermalink: !!media?.permalink,
    hasThumbnail: !!media?.thumbnailUrl,
    username: media?.username ?? null,
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
  // Prefer the commenter's handle when the webhook is for a comment mention
  // (media.username would be our own page in that case). Fall back to the
  // media owner's handle for `mentions` webhooks on posts/reels.
  const igUsername = normalizeHandle(event.igUsername ?? media.username);

  await hydrateWebhookInbox(env.granite_v2, {
    id: webhookId,
    igUsername,
    caption: captionText,
    mediaUrl: media.mediaUrl ?? media.permalink ?? "",
    permalinkUrl: media.permalink,
    thumbnailUrl: media.thumbnailUrl,
  });
  logStep("06.hydrated", {
    webhookId,
    igUsername,
    captionLen: captionText.length,
  });

  // Duplicate check
  const existing = await findExistingBetaByExternalMedia(env.granite_v2, event.mediaId);
  logStep("07.dup_check", {
    webhookId,
    duplicate: !!existing,
    existingBetaId: existing?.id ?? null,
  });
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
  logStep("08.tokens", {
    webhookId,
    tokenCount: captionTokens.size,
    tokens: Array.from(captionTokens).slice(0, 20),
  });
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
  logStep("09.matched_routes", {
    webhookId,
    candidateCount: candidates.length,
    matchCount: matches.length,
    matchedRouteIds: matches.map((m) => m.routeId),
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
  logStep("10.beta_insert.start", {
    webhookId,
    betaId: createdBetaId,
    routeId: route.routeId,
  });
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
  logStep("11.inbox_matched", {
    webhookId,
    betaId: createdBetaId,
    changes: matchResult.changes,
  });
  if (matchResult.changes === 0) {
    return;
  }

  // Thumbnail copy
  logStep("12.thumbnail.start", { webhookId, betaId: createdBetaId });
  const cdnUrl = await attemptThumbnailCopy(env.BUCKET, env.CDN_BASE_URL, createdBetaId, media);
  logStep("12.thumbnail.done", { webhookId, betaId: createdBetaId, ok: !!cdnUrl });
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
  logStep("13.complete", { webhookId, betaId: createdBetaId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("99.exception", {
      webhookId,
      createdBetaId,
      message: message.slice(0, 500),
    });
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
