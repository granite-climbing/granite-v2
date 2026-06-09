import { z } from "zod";
import {
  detectMediaPlatform,
  extractCanonicalMediaId,
  normalizeYouTubeOrInstagramUrl,
} from "@/lib/beta/normalize";

const manualBetaSchema = z.object({
  routeId: z.string().min(1),
  mediaUrl: z.string().url(),
  sentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function parseManualBetaForm(raw: Record<string, FormDataEntryValue>) {
  const parsed = manualBetaSchema.parse(raw);
  const mediaUrl = normalizeYouTubeOrInstagramUrl(parsed.mediaUrl);
  const platform = detectMediaPlatform(mediaUrl);
  return {
    routeId: parsed.routeId,
    mediaUrl,
    permalinkUrl: mediaUrl,
    externalMediaId: extractCanonicalMediaId(mediaUrl, platform),
    platform,
    sentAt: parsed.sentAt,
  };
}
