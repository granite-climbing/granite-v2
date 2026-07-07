import { NextRequest, NextResponse } from "next/server";
import { exchangeOAuthCode, fetchOAuthProfile } from "@/lib/auth/oauth/client";
import { isOAuthProvider } from "@/lib/auth/oauth/providers";
import { assertOAuthState, OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/oauth/state";
import { getOAuthRedirectUri } from "@/lib/auth/oauth/url";
import {
  createPendingSignupToken,
  getPendingSignupCookieOptions,
  PENDING_SIGNUP_COOKIE_NAME
} from "@/lib/auth/signup";
import {
  createUserSessionToken,
  getUserSessionCookieOptions,
  USER_SESSION_COOKIE_NAME
} from "@/lib/auth/session";
import { findUserByOAuthIdentity } from "@/lib/db/user-auth-queries";

export const runtime = "nodejs";

type OAuthCallbackContext = {
  params: Promise<{ provider: string }>;
};

type OAuthCallbackValues = {
  code: string | null;
  error: string | null;
  state: string | null;
};

export async function GET(request: NextRequest, context: OAuthCallbackContext): Promise<NextResponse> {
  const url = new URL(request.url);
  return handleOAuthCallback(request, context, {
    code: url.searchParams.get("code"),
    error: url.searchParams.get("error"),
    state: url.searchParams.get("state")
  });
}

export async function POST(request: NextRequest, context: OAuthCallbackContext): Promise<NextResponse> {
  const formData = await request.formData();
  return handleOAuthCallback(request, context, {
    code: getFormValue(formData, "code"),
    error: getFormValue(formData, "error"),
    state: getFormValue(formData, "state")
  });
}

async function handleOAuthCallback(
  request: NextRequest,
  context: OAuthCallbackContext,
  values: OAuthCallbackValues
): Promise<NextResponse> {
  const { provider: providerValue } = await context.params;
  if (!isOAuthProvider(providerValue)) {
    return redirectToLogin(request, "unsupported_provider");
  }

  if (values.error) {
    return redirectToLogin(request, values.error);
  }

  if (!values.code) {
    return redirectToLogin(request, "missing_code");
  }

  let state: ReturnType<typeof assertOAuthState>;
  try {
    state = assertOAuthState(values.state, request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value);
  } catch (error) {
    logOAuthCallbackError(providerValue, "invalid_state", error);
    return redirectToLogin(request, "invalid_state");
  }

  if (state.provider !== providerValue) {
    return redirectToLogin(request, "provider_mismatch");
  }

  let tokenSet: Awaited<ReturnType<typeof exchangeOAuthCode>>;
  try {
    tokenSet = await exchangeOAuthCode(providerValue, {
      code: values.code,
      redirectUri: getOAuthRedirectUri(providerValue),
      state: state.state
    });
  } catch (error) {
    logOAuthCallbackError(providerValue, "token_exchange_failed", error);
    return redirectToLogin(request, "token_exchange_failed");
  }

  let profile: Awaited<ReturnType<typeof fetchOAuthProfile>>;
  try {
    profile = await fetchOAuthProfile(providerValue, {
      accessToken: tokenSet.accessToken,
      idToken: tokenSet.idToken
    });
  } catch (error) {
    logOAuthCallbackError(providerValue, "profile_fetch_failed", error);
    return redirectToLogin(request, "profile_fetch_failed");
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
        returnTo: state.returnTo
      });
      const response = NextResponse.redirect(new URL("/signup", request.url));
      response.cookies.set(PENDING_SIGNUP_COOKIE_NAME, pendingSignupToken, getPendingSignupCookieOptions());
      response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
      return response;
    }

    const sessionToken = await createUserSessionToken({
      userId: user.id
    });
    const response = NextResponse.redirect(new URL(state.returnTo, request.url));
    setSessionCookies(response, sessionToken);
    return response;
  } catch (error) {
    logOAuthCallbackError(providerValue, "callback_failed", error);
    return redirectToLogin(request, "callback_failed");
  }
}

function setSessionCookies(response: NextResponse, sessionToken: string): void {
  response.cookies.set(USER_SESSION_COOKIE_NAME, sessionToken, getUserSessionCookieOptions());
  response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
}

function redirectToLogin(request: NextRequest, error: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
}

function logOAuthCallbackError(provider: string, stage: string, error: unknown): void {
  console.error("[auth.callback]", {
    provider,
    stage,
    message: error instanceof Error ? error.message : String(error)
  });
}

function getFormValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}
