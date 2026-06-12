import { NextRequest, NextResponse } from "next/server";
import {
  sanitizeAppWebSessionReturnTo,
  verifyAppWebSessionHandoffToken
} from "@/lib/auth/app-handoff";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE_NAME
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return redirectToLogin(request);
  }

  const handoff = await verifyAppWebSessionHandoffToken(code);
  if (!handoff) {
    return redirectToLogin(request);
  }

  const sessionToken = await createUserSessionToken({
    userId: handoff.userId
  });
  const returnTo = sanitizeAppWebSessionReturnTo(url.searchParams.get("returnTo"), handoff.returnTo);
  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserSessionCookieOptions());

  return response;
}

function redirectToLogin(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/login?error=invalid_app_handoff", request.url));
}
