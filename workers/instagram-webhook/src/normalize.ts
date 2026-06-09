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
