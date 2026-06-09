import type { MediaInfo } from "./graph-api";

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_HOSTS = new Set(["img.youtube.com"]);
const ALLOWED_IMAGE_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];

function isAllowedImageUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.has(host) || ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

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
  owner: { scope: "webhook" | "beta"; id: string },
  media: MediaInfo
): Promise<string | null> {
  const source = media.thumbnailUrl ?? media.mediaUrl;
  if (!source || !isAllowedImageUrl(source)) return null;

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

  const prefix = owner.scope === "webhook" ? "webhooks" : "betas";
  const key = `${prefix}/${owner.id}/thumb-${crypto.randomUUID()}.${extension}`;
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
