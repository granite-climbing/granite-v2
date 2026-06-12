import { NextRequest, NextResponse } from "next/server";
import { verifyNativeAuthHandoffToken } from "@/lib/auth/native-handoff";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE_NAME
} from "@/lib/auth/session";
import {
  createPendingSignupToken,
  getPendingSignupCookieOptions,
  PENDING_SIGNUP_COOKIE_NAME
} from "@/lib/auth/signup";
import { consumeNativeAuthHandoffToken } from "@/lib/db/native-auth-handoffs";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = new URL(request.url).searchParams.get("code");
  const token = code ? await consumeNativeAuthHandoffToken(code) : null;
  const handoff = token ? await verifyNativeAuthHandoffToken(token) : null;

  if (!handoff) {
    return NextResponse.redirect(new URL("/login?error=native_handoff_failed", request.url));
  }

  if (handoff.kind === "session") {
    const sessionToken = await createUserSessionToken({
      userId: handoff.userId
    });
    const response = NextResponse.redirect(new URL(handoff.returnTo, request.url));
    response.cookies.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserSessionCookieOptions());
    return response;
  }

  const pendingSignupToken = await createPendingSignupToken({
    provider: handoff.provider,
    providerUserId: handoff.providerUserId,
    email: handoff.email,
    displayName: handoff.displayName,
    avatarUrl: handoff.avatarUrl,
    returnTo: handoff.returnTo
  });
  const response = NextResponse.redirect(new URL("/signup", request.url));
  response.cookies.set(PENDING_SIGNUP_COOKIE_NAME, pendingSignupToken, getPendingSignupCookieOptions());
  return response;
}
