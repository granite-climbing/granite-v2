import { SignJWT, jwtVerify } from "jose";
import { getUserSessionSecret } from "./session";

export const PENDING_RECOVERY_COOKIE_NAME = "granite_pending_recovery";

/**
 * 세션 토큰과 같은 시크릿·같은 user_id 클레임을 쓰기 때문에, 이 값으로 토큰
 * 종류를 구분하지 않으면 두 토큰을 서로 바꿔치기할 수 있다. 반대 방향은
 * `verifyUserSessionToken` 이 typ 가 붙은 토큰을 거부해서 막는다.
 */
const RECOVERY_TOKEN_TYPE = "recovery";

export type PendingRecovery = {
  userId: string;
  returnTo: string;
};

export async function createPendingRecoveryToken(recovery: PendingRecovery): Promise<string> {
  return new SignJWT({
    typ: RECOVERY_TOKEN_TYPE,
    user_id: recovery.userId,
    return_to: sanitizeReturnTo(recovery.returnTo)
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getUserSessionSecret());
}

export async function verifyPendingRecoveryToken(token: string): Promise<PendingRecovery | null> {
  try {
    const verified = await jwtVerify(token, getUserSessionSecret());
    const userId = verified.payload.user_id;
    const returnTo = verified.payload.return_to;

    if (verified.payload.typ !== RECOVERY_TOKEN_TYPE || typeof userId !== "string") {
      return null;
    }

    return {
      userId,
      returnTo: typeof returnTo === "string" ? sanitizeReturnTo(returnTo) : "/me"
    };
  } catch {
    return null;
  }
}

export function getPendingRecoveryCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 15,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}

function sanitizeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/me";
  }

  return value;
}
