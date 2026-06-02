export function extractYouTubeThumbnailUrl(mediaUrl: string): string | null {
  const url = new URL(mediaUrl);
  const host = url.hostname.toLowerCase();
  const id = host === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v");
  if (!id || (!host.endsWith("youtube.com") && host !== "youtu.be")) return null;
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

export function extractInstagramHtmlThumbnailUrl(html: string): string | null {
  const metaPatterns = [
    /<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i,
    /<meta\s+[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["'][^>]*>/i,
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].replace(/&amp;/g, "&");
  }

  const jsonLdMatch = html.match(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
  if (jsonLdMatch?.[1]) {
    try {
      const parsed = JSON.parse(jsonLdMatch[1]) as { image?: unknown };
      if (typeof parsed.image === "string") return parsed.image;
      if (Array.isArray(parsed.image) && typeof parsed.image[0] === "string") return parsed.image[0];
    } catch {
      return null;
    }
  }

  return null;
}

export function inferImageExtensionFromContentType(contentType: string | null): "jpg" | "png" | "webp" | "gif" | null {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";
  return null;
}
