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

const DEFAULT_ANDROID_PACKAGE_NAME = "com.granite.climbing";
const NATIVE_APPLE_WEB_CALLBACK_STATE_PREFIX = "granite-native-apple-v1.";
const NATIVE_APPLE_WEB_CALLBACK_STATE_MIN_ENTROPY_LENGTH = 32;

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
  const { provider: providerValue } = await context.params;
  const formData = await request.formData();
  const state = getFormValue(formData, "state");

  if (providerValue === "apple" && isNativeAppleWebCallbackState(state)) {
    return redirectNativeAppleCallback(formData);
  }

  return handleOAuthCallback(request, context, {
    code: getFormValue(formData, "code"),
    error: getFormValue(formData, "error"),
    state
  });
}

function isNativeAppleWebCallbackState(state: string | null): boolean {
  if (!state?.startsWith(NATIVE_APPLE_WEB_CALLBACK_STATE_PREFIX)) {
    return false;
  }

  const entropy = state.slice(NATIVE_APPLE_WEB_CALLBACK_STATE_PREFIX.length);
  return /^[A-Za-z0-9_-]+$/.test(entropy) && entropy.length >= NATIVE_APPLE_WEB_CALLBACK_STATE_MIN_ENTROPY_LENGTH;
}

function redirectNativeAppleCallback(formData: FormData): NextResponse {
  const callbackParams = new URLSearchParams();

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      callbackParams.append(key, value);
    }
  }

  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim() || DEFAULT_ANDROID_PACKAGE_NAME;
  const intentUrl = `intent://callback?${callbackParams.toString()}#Intent;package=${packageName};scheme=signinwithapple;end`;
  return NextResponse.redirect(intentUrl);
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
    return redirectToLogin(request, "token_exchange_failed", {
      provider: providerValue,
      stage: "token_exchange_failed",
      message: getErrorMessage(error)
    });
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

type OAuthBrowserDiagnostic = {
  provider: string;
  stage: string;
  message: string;
};

function redirectToLogin(request: NextRequest, error: string, diagnostic?: OAuthBrowserDiagnostic): NextResponse {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);

  if (diagnostic) {
    url.searchParams.set("oauth_provider", sanitizeDiagnosticValue(diagnostic.provider));
    url.searchParams.set("oauth_stage", sanitizeDiagnosticValue(diagnostic.stage));
    url.searchParams.set("oauth_message", sanitizeDiagnosticValue(diagnostic.message));
  }

  return NextResponse.redirect(url);
}

function logOAuthCallbackError(provider: string, stage: string, error: unknown): void {
  console.error("[auth.callback]", {
    provider,
    stage,
    message: getErrorMessage(error)
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeDiagnosticValue(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").slice(0, 500);
}

function getFormValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}
