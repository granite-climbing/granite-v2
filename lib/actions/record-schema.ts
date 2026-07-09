import { z } from "zod";
import {
  detectMediaPlatform,
  extractCanonicalMediaId,
  normalizeYouTubeOrInstagramUrl,
} from "@/lib/beta/normalize";

const addRecordSchema = z.object({
  routeId: z.string().min(1),
  sentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rating: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(z.union([z.null(), z.number().int().min(1).max(5)])),
  mediaUrl: z
    .string()
    .optional()
    .transform((value) => (value && value.trim().length > 0 ? value.trim() : null))
    .pipe(z.union([z.null(), z.string().url()])),
});

export type AddRecordInput = z.output<typeof addRecordSchema>;

export function parseAddRecordForm(raw: Record<string, FormDataEntryValue>): AddRecordInput {
  return addRecordSchema.parse(raw);
}

// detectMediaPlatform/normalizeYouTubeOrInstagramUrl throw on unsupported URLs —
// callers surface that as a user-facing validation message.
export function parseRecordMediaUrl(rawUrl: string) {
  const mediaUrl = normalizeYouTubeOrInstagramUrl(rawUrl);
  const platform = detectMediaPlatform(mediaUrl);
  return {
    mediaUrl,
    permalinkUrl: mediaUrl,
    externalMediaId: extractCanonicalMediaId(mediaUrl, platform),
    platform,
  };
}
