import { assertAllowedExternalFetchUrl } from "./fetch-guard";
import { extractInstagramHtmlThumbnailUrl } from "./thumbnail";

export async function fetchInstagramHtmlThumbnail(postUrl: string): Promise<string | null> {
  try {
    assertAllowedExternalFetchUrl(postUrl, "page");
  } catch {
    return null;
  }
  const response = await fetch(postUrl, {
    headers: { "User-Agent": "Mozilla/5.0 GraniteBot/1.0" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const html = await response.text();
  return extractInstagramHtmlThumbnailUrl(html);
}
