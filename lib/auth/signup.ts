import { SignJWT, jwtVerify } from "jose";
import type { OAuthProviderId } from "./oauth/types";
import { getUserSessionSecret } from "./session";

export const PENDING_SIGNUP_COOKIE_NAME = "granite_pending_signup";

export type PendingSignup = {
  provider: OAuthProviderId;
  providerUserId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  returnTo: string;
};

export async function createPendingSignupToken(signup: PendingSignup): Promise<string> {
  return new SignJWT({
    provider: signup.provider,
    provider_user_id: signup.providerUserId,
    email: signup.email,
    display_name: signup.displayName,
    avatar_url: signup.avatarUrl,
    return_to: sanitizeReturnTo(signup.returnTo)
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getUserSessionSecret());
}

export async function verifyPendingSignupToken(token: string): Promise<PendingSignup | null> {
  try {
    const verified = await jwtVerify(token, getUserSessionSecret());
    const provider = verified.payload.provider;
    const providerUserId = verified.payload.provider_user_id;
    const email = verified.payload.email;
    const displayName = verified.payload.display_name;
    const avatarUrl = verified.payload.avatar_url;
    const returnTo = verified.payload.return_to;

    if (!isProvider(provider) || typeof providerUserId !== "string" || typeof displayName !== "string") {
      return null;
    }

    return {
      provider,
      providerUserId,
      email: typeof email === "string" ? email : null,
      displayName,
      avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null,
      returnTo: typeof returnTo === "string" ? sanitizeReturnTo(returnTo) : "/me"
    };
  } catch {
    return null;
  }
}

export function getPendingSignupCookieOptions() {
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

function isProvider(value: unknown): value is OAuthProviderId {
  return value === "kakao" || value === "naver" || value === "google" || value === "apple";
}
