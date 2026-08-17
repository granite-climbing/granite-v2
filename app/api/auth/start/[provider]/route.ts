import { NextRequest, NextResponse } from "next/server";
import {
  buildAuthorizationUrl,
  getOAuthProvider,
  isOAuthProvider,
  isOAuthProviderConfigured
} from "@/lib/auth/oauth/providers";
import { createOAuthState, OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/oauth/state";
import { getOAuthRedirectUri } from "@/lib/auth/oauth/url";

export const runtime = "nodejs";

type OAuthStartContext = {
  params: Promise<{ provider: string }>;
};

export async function GET(request: NextRequest, context: OAuthStartContext): Promise<NextResponse> {
  const { provider: providerValue } = await context.params;
  if (!isOAuthProvider(providerValue)) {
    return redirectToLogin(request, "unsupported_provider");
  }

  const provider = getOAuthProvider(providerValue);
  if (!isOAuthProviderConfigured(provider)) {
    return redirectToLogin(request, "provider_unavailable");
  }

  const url = new URL(request.url);
  const nativeSystemAuth = url.searchParams.get("native_system_auth");
  const handoffChallenge = url.searchParams.get("handoff_challenge");
  const isIosSystemAuth = nativeSystemAuth === "ios";
  if (
    nativeSystemAuth !== null &&
    (!isIosSystemAuth || providerValue !== "kakao" || !isValidHandoffChallenge(handoffChallenge))
  ) {
    return redirectToLogin(request, "invalid_native_auth_request");
  }

  const state = createOAuthState({
    provider: providerValue,
    returnTo: sanitizeReturnTo(url.searchParams.get("returnTo")),
    surface: isIosSystemAuth
      ? "ios-system-auth"
      : url.searchParams.get("native_fallback") === "1"
        ? "flutter-webview"
        : "web",
    handoffChallenge: isIosSystemAuth ? handoffChallenge : null
  });
  const response = NextResponse.redirect(
    buildAuthorizationUrl(providerValue, {
      redirectUri: getOAuthRedirectUri(providerValue),
      state: state.state,
      nonce: state.nonce,
      ...(isIosSystemAuth ? { prompt: "login" as const } : {})
    }).toString()
  );

  response.cookies.set(OAUTH_STATE_COOKIE_NAME, state.cookieValue, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
  return response;
}

function isValidHandoffChallenge(value: string | null): value is string {
  return value !== null && /^[A-Za-z0-9_-]{43}$/.test(value);
}

function redirectToLogin(request: NextRequest, error: string): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/me";
  }

  return value;
}
