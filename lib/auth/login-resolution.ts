import {
  findLoginCandidateByOAuthIdentity,
  purgeExpiredWithdrawnUser
} from "@/lib/db/user-auth-queries";
import type { User } from "@/lib/db/schema";
import type { OAuthProfile } from "./oauth/types";
import { getWithdrawalStatus } from "./withdrawal";

export type OAuthLoginResolution =
  | { kind: "session"; user: User }
  | { kind: "recover"; user: User }
  | { kind: "signup" };

/**
 * OAuth 프로필 하나로 로그인 결과를 결정한다.
 * 웹 콜백과 네이티브 세션 라우트가 같은 규칙을 쓰도록 여기 모았다.
 * 쿠키 설정과 이동 경로는 각 라우트가 처리한다.
 */
export async function resolveOAuthLogin(
  profile: OAuthProfile,
  now: Date
): Promise<OAuthLoginResolution> {
  const user = await findLoginCandidateByOAuthIdentity(profile.provider, profile.providerUserId);
  if (!user) {
    return { kind: "signup" };
  }

  const status = getWithdrawalStatus(user.withdrawAt, now);
  if (status === "active") {
    return { kind: "session", user };
  }

  if (status === "recoverable") {
    return { kind: "recover", user };
  }

  // 보관 기간이 끝났다. identity 를 끊어 같은 소셜 계정으로 새로 가입하게 한다.
  await purgeExpiredWithdrawnUser(user.id);
  return { kind: "signup" };
}
