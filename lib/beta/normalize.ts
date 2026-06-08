import type { BetaPlatform } from "@/lib/db/schema";

const SUPPORTED_HOSTS: Array<{ host: string; platform: BetaPlatform }> = [
  { host: "instagram.com", platform: "instagram" },
  { host: "www.instagram.com", platform: "instagram" },
  { host: "youtube.com", platform: "youtube" },
  { host: "www.youtube.com", platform: "youtube" },
  { host: "youtu.be", platform: "youtube" },
];

export function normalizeToken(value: string): string {
  return value
    .trim()
    .replace(/^#/, "")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}._-]/gu, "")
    .toLowerCase();
}

export function extractHashtags(caption: string): string[] {
  const matches = caption.match(/#[^\s#]+/gu) ?? [];
  return matches.map(normalizeToken).filter(Boolean);
}

export function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function detectMediaPlatform(rawUrl: string): BetaPlatform {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid media URL");
  }

  const match = SUPPORTED_HOSTS.find((entry) => entry.host === url.hostname.toLowerCase());
  if (!match) {
    throw new Error("Unsupported media URL");
  }
  return match.platform;
}

export function normalizeYouTubeOrInstagramUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  detectMediaPlatform(url.toString());
  url.hash = "";
  return url.toString();
}

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function extractCanonicalMediaId(rawUrl: string, platform: BetaPlatform): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();

  if (platform === "youtube") {
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? null;
      return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "www.youtube.com") {
      const v = url.searchParams.get("v");
      if (v && YOUTUBE_ID_PATTERN.test(v)) return v;
      const match = url.pathname.match(/^\/(shorts|embed)\/([A-Za-z0-9_-]+)/);
      if (match) return match[2];
      return null;
    }
    return null;
  }

  if (platform === "instagram") {
    if (host !== "instagram.com" && host !== "www.instagram.com") return null;
    const match = url.pathname.match(/^\/(p|reel|tv)\/([^/]+)/);
    return match ? match[2] : null;
  }

  return null;
}
