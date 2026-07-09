"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { findActiveUserById } from "@/lib/db/user-auth-queries";
import {
  createManualBeta,
  findExistingBetaByExternalMedia,
  findExistingBetaByPermalink,
  findPublishedRouteIdForBeta,
  updateBetaThumbnailUrl,
} from "@/lib/db/beta-queries";
import { insertUserRecord, searchPublishedRoutesForRecord } from "@/lib/db/record-queries";
import { acquireAndStoreBetaThumbnail } from "@/lib/beta/thumbnail-r2";
import { normalizeHandle } from "@/lib/beta/normalize";
import { parseHashtags } from "@/lib/db/queries";
import { parseAddRecordForm, parseRecordMediaUrl, type AddRecordInput } from "./record-schema";

export type AddRecordActionResult = {
  ok: boolean;
  message: string;
};

export type RouteSearchItemForRecord = {
  routeId: string;
  routeName: string;
  routeGrade: string;
  boulderName: string;
  sectorName: string;
  cragName: string;
  boulderHashtags: string[];
};

export async function searchRoutesForRecordAction(term: string): Promise<RouteSearchItemForRecord[]> {
  const rows = await searchPublishedRoutesForRecord(term);
  return rows.map((row) => ({
    routeId: row.routeId,
    routeName: row.routeName,
    routeGrade: row.routeGrade,
    boulderName: row.boulderName,
    sectorName: row.sectorName,
    cragName: row.cragName,
    boulderHashtags: parseHashtags(row.boulderHashtags),
  }));
}

export async function addRecordAction(formData: FormData): Promise<AddRecordActionResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  const user = session ? await findActiveUserById(session.userId) : null;
  if (!user) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  let parsed: AddRecordInput;
  try {
    parsed = parseAddRecordForm(Object.fromEntries(formData));
  } catch {
    return { ok: false, message: "입력값을 확인해주세요." };
  }

  const publishedRoute = await findPublishedRouteIdForBeta(parsed.routeId);
  if (!publishedRoute) {
    return { ok: false, message: "유효하지 않은 루트입니다." };
  }

  let betaId: string | null = null;
  if (parsed.mediaUrl) {
    let media: ReturnType<typeof parseRecordMediaUrl>;
    try {
      media = parseRecordMediaUrl(parsed.mediaUrl);
    } catch {
      return { ok: false, message: "Instagram 또는 YouTube 링크만 등록할 수 있습니다." };
    }

    let existing = media.externalMediaId
      ? await findExistingBetaByExternalMedia(media.platform, media.externalMediaId)
      : null;
    if (!existing) {
      existing = await findExistingBetaByPermalink(media.platform, media.permalinkUrl);
    }
    if (existing) {
      return { ok: false, message: "이미 등록된 영상입니다." };
    }

    betaId = `beta_${randomUUID()}`;
    await createManualBeta({
      id: betaId,
      routeId: parsed.routeId,
      userId: user.id,
      claimStatus: "claimed",
      instagramId: user.instagramId ? normalizeHandle(user.instagramId) : "",
      displayName: user.displayName,
      platform: media.platform,
      mediaUrl: media.mediaUrl,
      permalinkUrl: media.permalinkUrl,
      externalMediaId: media.externalMediaId,
      sentAt: parsed.sentAt,
    });

    try {
      const cdnUrl = await acquireAndStoreBetaThumbnail({
        betaId,
        platform: media.platform,
        postUrl: media.permalinkUrl,
      });
      if (cdnUrl) {
        await updateBetaThumbnailUrl(betaId, cdnUrl);
      }
    } catch (err) {
      console.warn("thumbnail acquisition failed:", err);
    }
  }

  await insertUserRecord({
    id: `rec_${randomUUID()}`,
    userId: user.id,
    routeId: parsed.routeId,
    betaId,
    sentAt: parsed.sentAt,
    rating: parsed.rating,
  });

  return { ok: true, message: "기록이 추가되었습니다." };
}
