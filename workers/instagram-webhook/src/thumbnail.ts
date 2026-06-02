import type { MentionedMedia } from "./graph-api";

export async function attemptThumbnailCopy(
  _bucket: R2Bucket,
  _cdnBase: string,
  _betaId: string,
  _media: MentionedMedia
): Promise<string | null> {
  // Phase 5 Task 9 will implement this. For Task 6, return null (no thumbnail).
  return null;
}
