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
