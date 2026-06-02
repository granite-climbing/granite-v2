import type { Env } from "./index";
import type { MentionEvent } from "./payload";
import {
  findExistingBetaByExternalMedia,
  findPublishedRouteCandidates,
  insertWebhookBeta,
  insertWebhookInbox,
  insertWebhookOperationalEvent,
  setWebhookInboxStatus,
} from "./d1";
import { fetchMentionedComment, fetchMentionedMedia } from "./graph-api";
import { extractHashtags, normalizeHandle, normalizeToken } from "./normalize";

function uuid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function processMentionEvent(
  event: MentionEvent,
  env: Env,
  rawPayload: string
): Promise<void> {
  const webhookId = uuid("webhook");

  const inserted = await insertWebhookInbox(env.granite_v2, {
    id: webhookId,
    externalId: event.externalId,
    igUserId: event.igUserId,
    igUsername: "",
    caption: "",
    mediaUrl: "",
    thumbnailUrl: null,
    rawPayload,
  });

  if (!inserted.inserted) {
    // Already processed (idempotent): nothing to do.
    return;
  }

  await setWebhookInboxStatus(env.granite_v2, {
    id: webhookId,
    status: "processing",
    incrementAttempts: true,
  });

  let captionText = "";
  if (event.commentId) {
    const comment = await fetchMentionedComment({
      igUserId: event.igUserId,
      commentId: event.commentId,
      accessToken: env.INSTAGRAM_GRAPH_ACCESS_TOKEN,
    });
    if (!comment) {
      await setWebhookInboxStatus(env.granite_v2, {
        id: webhookId,
        status: "failed",
        lastErrorCode: "graph_api_failure",
        lastErrorMessage: "mentioned_comment fetch failed",
      });
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
    await setWebhookInboxStatus(env.granite_v2, {
      id: webhookId,
      status: "failed",
      lastErrorCode: "graph_api_failure",
      lastErrorMessage: "mentioned_media fetch failed",
    });
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

  // Duplicate check
  const existing = await findExistingBetaByExternalMedia(env.granite_v2, event.mediaId);
  if (existing) {
    await setWebhookInboxStatus(env.granite_v2, {
      id: webhookId,
      status: "duplicate",
      matchedBetaId: existing.id,
      lastErrorCode: "duplicate_beta",
    });
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
    await setWebhookInboxStatus(env.granite_v2, {
      id: webhookId,
      status: "unmatched",
      lastErrorCode: "caption_parse_failed",
    });
    return;
  }

  const candidates = await findPublishedRouteCandidates(env.granite_v2);
  const matches = candidates.filter((c) => {
    const boulderToken = normalizeToken(c.boulderName);
    const routeToken = normalizeToken(c.routeName);
    return captionTokens.has(boulderToken) && captionTokens.has(routeToken);
  });

  if (matches.length !== 1) {
    await setWebhookInboxStatus(env.granite_v2, {
      id: webhookId,
      status: "unmatched",
      lastErrorCode: matches.length > 1 ? "route_match_ambiguous" : "",
    });
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
  const betaId = uuid("beta");
  await insertWebhookBeta(env.granite_v2, {
    id: betaId,
    routeId: route.routeId,
    instagramId: igUsername,
    displayName: igUsername,
    mediaUrl: media.mediaUrl ?? media.permalink ?? "",
    permalinkUrl: media.permalink,
    externalMediaId: event.mediaId,
    sentAt: new Date().toISOString().slice(0, 10),
  });

  await setWebhookInboxStatus(env.granite_v2, {
    id: webhookId,
    status: "matched",
    matchedBetaId: betaId,
  });

  // Thumbnail copy (Task 9 will implement; stub returns null in Task 6)
  const cdnUrl = await import("./thumbnail").then((m) =>
    m.attemptThumbnailCopy(env.BUCKET, env.CDN_BASE_URL, betaId, media)
  );
  if (cdnUrl) {
    await env.granite_v2
      .prepare(`UPDATE betas SET thumbnail_url = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(cdnUrl, betaId)
      .run();
  }
}
