export type MediaInfo = {
  username: string;
  caption: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
};

export type CommentInfo = {
  text: string;
  mediaId: string | null;
};

const GRAPH_VERSION = "v25.0";
// Legacy Instagram Graph API (Facebook Login + connected Page).
// The new "Instagram API with Instagram Login" exposes graph.instagram.com but
// does NOT support `mentions` webhooks or the `mentioned_media` edge, so
// caption-mention lookups must go through this path.
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Fetch a media item via the mentioned_media edge on the business account.
 *
 * Required because direct `GET /{media-id}` only works for media the token
 * holder owns, while we want to read media on someone else's account that
 * @-mentioned us. The mentioned_media edge is the IG-sanctioned way to read
 * that media.
 */
export async function fetchMentionedMedia(input: {
  businessAccountId: string;
  mediaId: string;
  accessToken: string;
}): Promise<MediaInfo | null> {
  const url = new URL(`${GRAPH_BASE}/${input.businessAccountId}`);
  url.searchParams.set(
    "fields",
    `mentioned_media.media_id(${input.mediaId}){thumbnail_url,media_url,caption,username,media_type,permalink}`
  );
  url.searchParams.set("access_token", input.accessToken);

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;

  const json = (await response.json()) as { mentioned_media?: unknown };
  const m = json.mentioned_media;
  if (typeof m !== "object" || m === null) return null;
  const obj = m as Record<string, unknown>;
  return {
    username: typeof obj.username === "string" ? obj.username : "",
    caption: typeof obj.caption === "string" ? obj.caption : "",
    mediaUrl: typeof obj.media_url === "string" ? obj.media_url : null,
    thumbnailUrl: typeof obj.thumbnail_url === "string" ? obj.thumbnail_url : null,
    permalink: typeof obj.permalink === "string" ? obj.permalink : null,
  };
}

/**
 * Fetch a comment via the mentioned_comment edge. Only used as a fallback
 * when the `comments` webhook payload doesn't already carry the comment body
 * inline (legacy IG Graph API delivers minimal payload for some events).
 */
export async function fetchMentionedComment(input: {
  businessAccountId: string;
  commentId: string;
  accessToken: string;
}): Promise<CommentInfo | null> {
  const url = new URL(`${GRAPH_BASE}/${input.businessAccountId}`);
  url.searchParams.set(
    "fields",
    `mentioned_comment.comment_id(${input.commentId}){text,media}`
  );
  url.searchParams.set("access_token", input.accessToken);

  const response = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;

  const json = (await response.json()) as { mentioned_comment?: unknown };
  const c = json.mentioned_comment;
  if (typeof c !== "object" || c === null) return null;
  const obj = c as Record<string, unknown>;
  const media = obj.media;
  const mediaId =
    typeof media === "object" && media !== null && typeof (media as Record<string, unknown>).id === "string"
      ? (media as Record<string, string>).id
      : null;
  return {
    text: typeof obj.text === "string" ? obj.text : "",
    mediaId,
  };
}
