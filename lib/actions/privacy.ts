"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { findActiveUserById, updateUserPrivacyVisibility } from "@/lib/db/user-auth-queries";
import {
  parsePrivacyVisibility,
  sanitizePrivacyPatch,
  serializePrivacyVisibility
} from "@/lib/user/privacy-visibility";

export type UpdatePrivacyVisibilityResult = {
  ok: boolean;
  message?: string;
};

/**
 * 여러 토글 변경분(patch)을 한 번에 받아 병합 후 단일 컬럼에 저장한다.
 * 클라이언트가 디바운스로 모아 호출하는 것을 전제로 한다.
 */
export async function updatePrivacyVisibilityAction(
  patch: Record<string, boolean>
): Promise<UpdatePrivacyVisibilityResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifyUserSessionToken(token) : null;
  if (!session) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  const cleanPatch = sanitizePrivacyPatch(patch);
  if (Object.keys(cleanPatch).length === 0) {
    return { ok: false, message: "변경할 항목이 없습니다." };
  }

  const user = await findActiveUserById(session.userId);
  if (!user) {
    return { ok: false, message: "로그인이 필요합니다." };
  }

  const next = { ...parsePrivacyVisibility(user.privacyVisibility), ...cleanPatch };
  await updateUserPrivacyVisibility(user.id, serializePrivacyVisibility(next));

  revalidatePath("/me");
  return { ok: true };
}
