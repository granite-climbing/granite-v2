"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { after } from "next/server";
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
  if (!session) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  let parsed: AddRecordInput;
  try {
    parsed = parseAddRecordForm(Object.fromEntries(formData));
  } catch {
    return { ok: false, message: "입력값을 확인해주세요." };
  }

  // 사용자 조회와 루트 검증은 서로 독립적 — D1 HTTP 왕복을 줄이기 위해 병렬 실행.
  const [user, publishedRoute] = await Promise.all([
    findActiveUserById(session.userId),
    findPublishedRouteIdForBeta(parsed.routeId),
  ]);
  if (!user) {
    return { ok: false, message: "로그인이 필요합니다." };
  }
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

    const [byExternalMedia, byPermalink] = await Promise.all([
      media.externalMediaId
        ? findExistingBetaByExternalMedia(media.platform, media.externalMediaId)
        : Promise.resolve(null),
      findExistingBetaByPermalink(media.platform, media.permalinkUrl),
    ]);
    if (byExternalMedia ?? byPermalink) {
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

    // 썸네일 획득(외부 fetch + R2 업로드)은 1~3초 걸리므로 응답 후로 미룬다.
    const pendingBetaId = betaId;
    const { platform, permalinkUrl } = media;
    after(async () => {
      try {
        const cdnUrl = await acquireAndStoreBetaThumbnail({
          betaId: pendingBetaId,
          platform,
          postUrl: permalinkUrl,
        });
        if (cdnUrl) {
          await updateBetaThumbnailUrl(pendingBetaId, cdnUrl);
        }
      } catch (err) {
        console.warn("thumbnail acquisition failed:", err);
      }
    });
  }

  await insertUserRecord({
    id: `rec_${randomUUID()}`,
    userId: user.id,
    routeId: parsed.routeId,
    betaId,
    sentAt: parsed.sentAt,
    rating: parsed.rating,
    feltGradeNum: parsed.feltGradeNum,
    comment: parsed.comment,
  });

  return { ok: true, message: "기록이 추가되었습니다." };
}
