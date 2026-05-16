type CloudflareImageLoaderParams = {
  src: string;
  width: number;
  quality?: number;
};

export default function cloudflareImageLoader({
  src,
  width,
  quality
}: CloudflareImageLoaderParams): string {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const url = new URL(src);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(quality ?? 75));
    return url.toString();
  }

  const baseUrl = process.env.CDN_BASE_URL ?? "";
  const normalizedSrc = src.startsWith("/") ? src : `/${src}`;
  return `${baseUrl}${normalizedSrc}?w=${width}&q=${quality ?? 75}`;
}
