export type InstagramOEmbedResult = {
  thumbnailUrl: string | null;
  authorName: string | null;
};

export async function fetchInstagramOEmbed(input: {
  postUrl: string;
  appId: string;
  appSecret: string;
}): Promise<InstagramOEmbedResult | null> {
  const url = new URL("https://graph.facebook.com/v21.0/instagram_oembed");
  url.searchParams.set("url", input.postUrl);
  url.searchParams.set("fields", "thumbnail_url,author_name,provider_name,provider_url");
  url.searchParams.set("access_token", `${input.appId}|${input.appSecret}`);

  const response = await fetch(url);
  if (!response.ok) return null;

  const json = (await response.json()) as { thumbnail_url?: unknown; author_name?: unknown };
  return {
    thumbnailUrl: typeof json.thumbnail_url === "string" ? json.thumbnail_url : null,
    authorName: typeof json.author_name === "string" ? json.author_name : null,
  };
}
