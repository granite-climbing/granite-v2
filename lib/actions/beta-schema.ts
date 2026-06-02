import { z } from "zod";
import {
  detectMediaPlatform,
  normalizeHandle,
  normalizeYouTubeOrInstagramUrl,
} from "@/lib/beta/normalize";

const manualBetaSchema = z.object({
  routeId: z.string().min(1),
  mediaUrl: z.string().url(),
  displayName: z.string().trim().min(1).max(40),
  instagramId: z.string().trim().max(40).default(""),
  sentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function parseManualBetaForm(raw: Record<string, FormDataEntryValue>) {
  const parsed = manualBetaSchema.parse(raw);
  const mediaUrl = normalizeYouTubeOrInstagramUrl(parsed.mediaUrl);
  return {
    routeId: parsed.routeId,
    mediaUrl,
    permalinkUrl: mediaUrl,
    externalMediaId: null,
    displayName: parsed.displayName.trim(),
    instagramId: normalizeHandle(parsed.instagramId),
    platform: detectMediaPlatform(mediaUrl),
    sentAt: parsed.sentAt,
  };
}
