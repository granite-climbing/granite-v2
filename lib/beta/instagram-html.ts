import { assertAllowedExternalFetchUrl } from "./fetch-guard";
import { extractInstagramHtmlAuthorName, extractInstagramHtmlThumbnailUrl } from "./thumbnail";

async function fetchInstagramHtml(postUrl: string): Promise<string | null> {
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
  return response.text();
}

export async function fetchInstagramHtmlThumbnail(postUrl: string): Promise<string | null> {
  const html = await fetchInstagramHtml(postUrl);
  if (!html) return null;
  return extractInstagramHtmlThumbnailUrl(html);
}

export async function fetchInstagramHtmlAuthorName(postUrl: string): Promise<string | null> {
  const html = await fetchInstagramHtml(postUrl);
  if (!html) return null;
  return extractInstagramHtmlAuthorName(html);
}
