export type MentionEvent = {
  externalId: string;
  igUserId: string;
  mediaId: string;
  commentId: string | null;
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
    const igUserId = asString(e.id);
    if (!igUserId) continue;
    const changes = e.changes;
    if (!Array.isArray(changes)) continue;
    for (const c of changes) {
      if (!isObject(c)) continue;
      if (c.field !== "mentions") continue;
      if (!isObject(c.value)) continue;
      const mediaId = asString(c.value.media_id);
      if (!mediaId) continue;
      const commentId = asString(c.value.comment_id);
      events.push({
        externalId: commentId ?? mediaId,
        igUserId,
        mediaId,
        commentId,
      });
    }
  }
  return events;
}
