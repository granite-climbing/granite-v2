export type MentionedMedia = {
  username: string;
  caption: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
};

export type MentionedComment = {
  text: string;
  mediaId: string | null;
};

const GRAPH_VERSION = "v21.0";

export async function fetchMentionedMedia(input: {
  igUserId: string;
  mediaId: string;
  accessToken: string;
}): Promise<MentionedMedia | null> {
  const fields = `mentioned_media.media_id(${input.mediaId}){thumbnail_url,media_url,caption,username,media_type,permalink}`;
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${input.igUserId}`);
  url.searchParams.set("fields", fields);
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

export async function fetchMentionedComment(input: {
  igUserId: string;
  commentId: string;
  accessToken: string;
}): Promise<MentionedComment | null> {
  const fields = `mentioned_comment.comment_id(${input.commentId}){text,media}`;
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${input.igUserId}`);
  url.searchParams.set("fields", fields);
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
