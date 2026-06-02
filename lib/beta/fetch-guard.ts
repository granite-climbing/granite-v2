const ALLOWED_PAGE_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "img.youtube.com",
]);

const ALLOWED_IMAGE_HOSTS = new Set(["img.youtube.com"]);
const ALLOWED_IMAGE_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];

export function assertAllowedExternalFetchUrl(rawUrl: string, purpose: "page" | "image" = "page"): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Unsupported external fetch protocol");
  const host = url.hostname.toLowerCase();
  const allowed =
    purpose === "page"
      ? ALLOWED_PAGE_HOSTS.has(host)
      : ALLOWED_IMAGE_HOSTS.has(host) || ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  if (!allowed) {
    throw new Error("Unsupported external fetch host");
  }
  return url;
}

export function isAllowedImageContentType(contentType: string | null): boolean {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  return normalized === "image/jpeg" || normalized === "image/png" || normalized === "image/webp" || normalized === "image/gif";
}
