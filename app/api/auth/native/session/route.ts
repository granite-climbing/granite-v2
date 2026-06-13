import { NextRequest, NextResponse } from "next/server";
import { fetchOAuthProfile } from "@/lib/auth/oauth/client";
import type { OAuthProviderId } from "@/lib/auth/oauth/types";
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
import { findUserByOAuthIdentity } from "@/lib/db/user-auth-queries";

export const runtime = "nodejs";

type NativeSessionBody = {
  provider?: unknown;
  accessToken?: unknown;
  idToken?: unknown;
  returnTo?: unknown;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readBody(request);
  const provider = body?.provider;
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken : "";
  const idToken = typeof body?.idToken === "string" ? body.idToken : null;
  const returnTo = sanitizeReturnTo(typeof body?.returnTo === "string" ? body.returnTo : "/me");

  if (!isNativeSessionProvider(provider)) {
    return redirectToLogin(request, "unsupported_provider");
  }

  if (!hasProviderToken(provider, accessToken, idToken)) {
    return redirectToLogin(request, "missing_provider_token");
  }

  let profile: Awaited<ReturnType<typeof fetchOAuthProfile>>;
  try {
    profile = await fetchOAuthProfile(provider, {
      accessToken,
      idToken
    });
  } catch (error) {
    logNativeSessionError(provider, "profile_fetch_failed", error);
    return redirectToLogin(request, "native_profile_failed");
  }

  try {
    const user = await findUserByOAuthIdentity(profile.provider, profile.providerUserId);
    if (!user) {
      const pendingSignupToken = await createPendingSignupToken({
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        returnTo
      });
      const response = NextResponse.redirect(new URL("/signup", request.url), 303);
      response.cookies.set(PENDING_SIGNUP_COOKIE_NAME, pendingSignupToken, getPendingSignupCookieOptions());
      return response;
    }

    const sessionToken = await createUserSessionToken({
      userId: user.id
    });
    const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
    response.cookies.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserSessionCookieOptions());
    return response;
  } catch (error) {
    logNativeSessionError(provider, "session_create_failed", error);
    return redirectToLogin(request, "native_session_failed");
  }
}

async function readBody(request: NextRequest): Promise<NativeSessionBody | null> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return (await request.json()) as NativeSessionBody;
    } catch {
      return null;
    }
  }

  try {
    const formData = await request.formData();
    return {
      provider: getFormValue(formData, "provider"),
      accessToken: getFormValue(formData, "accessToken"),
      idToken: getFormValue(formData, "idToken"),
      returnTo: getFormValue(formData, "returnTo")
    };
  } catch {
    return null;
  }
}

function redirectToLogin(request: NextRequest, error: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url), 303);
}

function sanitizeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/me";
  }

  return value;
}

function isNativeSessionProvider(value: unknown): value is OAuthProviderId {
  return value === "kakao" || value === "naver" || value === "google" || value === "apple";
}

function hasProviderToken(provider: OAuthProviderId, accessToken: string, idToken: string | null): boolean {
  if (provider === "apple") {
    return Boolean(idToken);
  }

  if (provider === "google") {
    return Boolean(accessToken || idToken);
  }

  return Boolean(accessToken);
}

function getFormValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function logNativeSessionError(provider: string, stage: string, error: unknown): void {
  console.error("[auth.native.session]", {
    provider,
    stage,
    message: error instanceof Error ? error.message : String(error)
  });
}
