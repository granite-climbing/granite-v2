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

    if (typeof userId !== "string") {
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
