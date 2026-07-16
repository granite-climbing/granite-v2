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
  const state = createOAuthState({
    provider: providerValue,
    returnTo: sanitizeReturnTo(url.searchParams.get("returnTo")),
    surface: url.searchParams.get("native_fallback") === "1" ? "flutter-webview" : "web"
  });
  const response = NextResponse.redirect(
    buildAuthorizationUrl(providerValue, {
      redirectUri: getOAuthRedirectUri(providerValue),
      state: state.state,
      nonce: state.nonce
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
