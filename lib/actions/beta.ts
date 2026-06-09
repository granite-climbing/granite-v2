"use server";

import { randomUUID } from "node:crypto";
import { revalidateTag } from "next/cache";
import {
  createManualBeta,
  findExistingBetaByExternalMedia,
  findExistingBetaByPermalink,
  findPublishedRouteIdForBeta,
  updateBetaThumbnailUrl,
} from "@/lib/db/beta-queries";
import { acquireAndStoreBetaThumbnail } from "@/lib/beta/thumbnail-r2";
import { parseManualBetaForm } from "./beta-schema";

export type ManualBetaActionResult = {
  ok: boolean;
  message: string;
};

export async function submitManualBetaAction(formData: FormData): Promise<ManualBetaActionResult> {
  const parsed = parseManualBetaForm(Object.fromEntries(formData));

  const publishedRoute = await findPublishedRouteIdForBeta(parsed.routeId);
  if (!publishedRoute) {
    return { ok: false, message: "유효하지 않은 루트입니다." };
  }

  let existing = null;
  if (parsed.externalMediaId) {
    existing = await findExistingBetaByExternalMedia(parsed.platform, parsed.externalMediaId);
  }
  if (!existing) {
    existing = await findExistingBetaByPermalink(parsed.platform, parsed.permalinkUrl);
  }
  if (existing) {
    return { ok: false, message: "이미 등록된 영상입니다." };
  }

  const betaId = `beta_${randomUUID()}`;
  await createManualBeta({
    id: betaId,
    routeId: parsed.routeId,
    instagramId: parsed.instagramId,
    displayName: parsed.displayName,
    platform: parsed.platform,
    mediaUrl: parsed.mediaUrl,
    permalinkUrl: parsed.permalinkUrl,
    externalMediaId: parsed.externalMediaId,
    sentAt: parsed.sentAt,
  });

  try {
    const cdnUrl = await acquireAndStoreBetaThumbnail({
      betaId,
      platform: parsed.platform,
      postUrl: parsed.permalinkUrl,
    });
    if (cdnUrl) {
      await updateBetaThumbnailUrl(betaId, cdnUrl);
    }
  } catch (err) {
    console.warn("thumbnail acquisition failed:", err);
  }

  revalidateTag(`route:${parsed.routeId}`);
  return { ok: true, message: "베타 영상이 등록되었습니다." };
}
