import type { MentionedMedia } from "./graph-api";

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

function inferExtension(contentType: string | null): "jpg" | "png" | "webp" | "gif" | null {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  return null;
}

export async function attemptThumbnailCopy(
  bucket: R2Bucket,
  cdnBase: string,
  betaId: string,
  media: MentionedMedia
): Promise<string | null> {
  const source = media.thumbnailUrl ?? media.mediaUrl;
  if (!source) return null;

  let response: Response;
  try {
    response = await fetch(source, { signal: AbortSignal.timeout(5000) });
  } catch {
    return null;
  }
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type");
  const extension = inferExtension(contentType);
  if (!extension) return null;

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_THUMBNAIL_BYTES) return null;

  const key = `betas/${betaId}/thumb-${crypto.randomUUID()}.${extension}`;
  try {
    await bucket.put(key, bytes, {
      httpMetadata: { contentType: contentType ?? `image/${extension}` },
    });
  } catch {
    return null;
  }

  const base = cdnBase.replace(/\/$/, "");
  return `${base}/${key}`;
}
