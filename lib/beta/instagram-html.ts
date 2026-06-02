import { extractInstagramHtmlThumbnailUrl } from "./thumbnail";

export async function fetchInstagramHtmlThumbnail(postUrl: string): Promise<string | null> {
  const response = await fetch(postUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 GraniteBot/1.0",
    },
  });
  if (!response.ok) return null;
  const html = await response.text();
  return extractInstagramHtmlThumbnailUrl(html);
}
