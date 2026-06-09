export type MentionEvent = {
  externalId: string;
  entryId: string;
  igUserId: string | null;
  igUsername: string | null;
  mediaId: string;
  commentId: string | null;
  /** For `comments`-field webhooks, the comment body is delivered inline. */
  commentText: string | null;
};

type Unknown = Record<string, unknown>;

function isObject(value: unknown): value is Unknown {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function extractMentionEvents(payload: unknown): MentionEvent[] {
  if (!isObject(payload)) return [];
  const entry = payload.entry;
  if (!Array.isArray(entry)) return [];

  const events: MentionEvent[] = [];
  for (const e of entry) {
    if (!isObject(e)) continue;
    const entryId = asString(e.id);
    if (!entryId) continue;
    const changes = e.changes;
    if (!Array.isArray(changes)) continue;
    for (const c of changes) {
      if (!isObject(c)) continue;
      if (c.field !== "mentions" && c.field !== "comments") continue;
      if (!isObject(c.value)) continue;

      // `mentions` webhooks use flat snake_case keys.
      // `comments` webhooks nest the media object and put the comment id at `value.id`.
      const nestedMedia = isObject(c.value.media) ? c.value.media : null;
      const mediaId =
        asString(c.value.media_id) ?? (nestedMedia ? asString(nestedMedia.id) : null);
      if (!mediaId) continue;
      const commentId =
        asString(c.value.comment_id) ??
        (c.field === "comments" ? asString(c.value.id) : null);

      const from = isObject(c.value.from) ? c.value.from : null;
      const igUserId = from ? asString(from.id) : null;
      const igUsername = from ? asString(from.username) : null;
      const commentText = asString(c.value.text);

      events.push({
        externalId: commentId ?? mediaId,
        entryId,
        igUserId,
        igUsername,
        mediaId,
        commentId,
        commentText,
      });
    }
  }
  return events;
}
