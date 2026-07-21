import { SignJWT, jwtVerify } from "jose";

export const USER_SESSION_COOKIE_NAME = "granite_session";

const encoder = new TextEncoder();

export type UserSession = {
  userId: string;
};

export function getUserSessionSecret(): Uint8Array {
  return encoder.encode(process.env.JWT_SECRET ?? "granite-local-user-secret");
}

export async function createUserSessionToken(session: UserSession): Promise<string> {
  return new SignJWT({ user_id: session.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getUserSessionSecret());
}

export async function verifyUserSessionToken(token: string): Promise<UserSession | null> {
  try {
    const verified = await jwtVerify(token, getUserSessionSecret());
    const userId = verified.payload.user_id;

    // 세션 토큰에는 typ 가 없다. typ 가 붙은 토큰(예: 복구 토큰)은 같은 시크릿으로
    // 서명되고 user_id 도 갖고 있어서, 거르지 않으면 세션 쿠키 자리에 그대로 먹힌다.
    if (verified.payload.typ !== undefined || typeof userId !== "string") {
      return null;
    }

    return { userId };
  } catch {
    return null;
  }
}

export function getUserSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}
