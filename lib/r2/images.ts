export type ImageEntityType = "areas" | "crags" | "sectors" | "boulders" | "topos" | "routes" | "announcements";

export function buildR2ImageKey(params: {
  entityType: ImageEntityType;
  entityId: string;
  purpose: string;
  extension: string;
  uuid?: string;
}): string {
  const safeExtension = params.extension.replace(/^\./, "").toLowerCase();
  const safePurpose = params.purpose.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const id = params.uuid ?? crypto.randomUUID();
  return `${params.entityType}/${params.entityId}/${safePurpose}-${id}.${safeExtension}`;
}

export function buildCdnImageUrl(key: string, options?: { width?: number; quality?: number }): string {
  const baseUrl = process.env.CDN_BASE_URL ?? "https://cdn.granite.kr";
  const url = new URL(key.startsWith("/") ? key : `/${key}`, baseUrl);

  if (options?.width) {
    url.searchParams.set("w", String(options.width));
  }
  if (options?.quality) {
    url.searchParams.set("q", String(options.quality));
  }

  return url.toString();
}
