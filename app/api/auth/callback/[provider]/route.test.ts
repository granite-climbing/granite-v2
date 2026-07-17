import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createOAuthState, OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/oauth/state";
import { PENDING_SIGNUP_COOKIE_NAME, verifyPendingSignupToken } from "@/lib/auth/signup";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { GET, POST } from "./route";

const exchangeOAuthCodeMock = vi.hoisted(() => vi.fn());
const fetchOAuthProfileMock = vi.hoisted(() => vi.fn());
const findUserByOAuthIdentityMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/oauth/client", () => ({
  exchangeOAuthCode: exchangeOAuthCodeMock,
  fetchOAuthProfile: fetchOAuthProfileMock
}));

vi.mock("@/lib/db/user-auth-queries", () => ({
  findUserByOAuthIdentity: findUserByOAuthIdentityMock
}));

const originalJwtSecret = process.env.JWT_SECRET;
const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalAndroidPackageName = process.env.ANDROID_PACKAGE_NAME;

describe("OAuth callback route", () => {
  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.APP_BASE_URL = originalAppBaseUrl;
    process.env.ANDROID_PACKAGE_NAME = originalAndroidPackageName;
    exchangeOAuthCodeMock.mockReset();
    fetchOAuthProfileMock.mockReset();
    findUserByOAuthIdentityMock.mockReset();
  });

  it("sets the Granite session cookie when the provider identity already exists", async () => {
    process.env.JWT_SECRET = "callback-test-secret";
    process.env.APP_BASE_URL = "https://granite.kr";
    const state = createOAuthState({
      provider: "google",
      returnTo: "/me"
    });
    exchangeOAuthCodeMock.mockResolvedValueOnce({
      accessToken: "access-token",
      tokenType: "Bearer",
      expiresIn: 3600,
      refreshToken: null,
      idToken: "id-token",
      scope: "openid email profile"
    });
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider: "google",
      providerUserId: "google-user",
      email: "google@example.com",
      displayName: "Google Climber",
      avatarUrl: null
    });
    findUserByOAuthIdentityMock.mockResolvedValueOnce({
      id: "user_google",
      email: "google@example.com",
      displayName: "Google Climber",
      avatarUrl: null
    });

    const request = new NextRequest(`https://granite.kr/api/auth/callback/google?code=abc&state=${state.state}`, {
      headers: {
        cookie: `${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state.cookieValue)}`
      }
    });
    const response = await GET(request, { params: Promise.resolve({ provider: "google" }) });
    const setCookie = response.headers.get("set-cookie") ?? "";
    const sessionToken = readCookieValue(setCookie, USER_SESSION_COOKIE_NAME);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/me");
    expect(exchangeOAuthCodeMock).toHaveBeenCalledWith("google", {
      code: "abc",
      redirectUri: "https://granite.kr/api/auth/callback/google",
      state: state.state
    });
    expect(findUserByOAuthIdentityMock).toHaveBeenCalledWith("google", "google-user");
    await expect(verifyUserSessionToken(sessionToken ?? "")).resolves.toEqual({
      userId: "user_google"
    });
  });

  it("uses APP_BASE_URL for the token exchange redirect URI", async () => {
    process.env.JWT_SECRET = "callback-test-secret";
    process.env.APP_BASE_URL = "https://v2.granite.kr";
    const state = createOAuthState({
      provider: "google",
      returnTo: "/me"
    });
    exchangeOAuthCodeMock.mockResolvedValueOnce({
      accessToken: "access-token",
      tokenType: "Bearer",
      expiresIn: 3600,
      refreshToken: null,
      idToken: "id-token",
      scope: "openid email profile"
    });
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider: "google",
      providerUserId: "google-user",
      email: "google@example.com",
      displayName: "Google Climber",
      avatarUrl: null
    });
    findUserByOAuthIdentityMock.mockResolvedValueOnce({
      id: "user_google",
      email: "google@example.com",
      displayName: "Google Climber",
      avatarUrl: null
    });

    const request = new NextRequest(`https://v2-preview.granite.kr/api/auth/callback/google?code=abc&state=${state.state}`, {
      headers: {
        cookie: `${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state.cookieValue)}`
      }
    });

    await GET(request, { params: Promise.resolve({ provider: "google" }) });

    expect(exchangeOAuthCodeMock).toHaveBeenCalledWith("google", {
      code: "abc",
      redirectUri: "https://v2.granite.kr/api/auth/callback/google",
      state: state.state
    });
  });

  it("redirects first-time provider identities to signup with a pending signup cookie", async () => {
    process.env.JWT_SECRET = "callback-test-secret";
    process.env.APP_BASE_URL = "https://granite.kr";
    const state = createOAuthState({
      provider: "kakao",
      returnTo: "/r/route_1"
    });
    exchangeOAuthCodeMock.mockResolvedValueOnce({
      accessToken: "access-token",
      tokenType: "Bearer",
      expiresIn: 3600,
      refreshToken: null,
      idToken: null,
      scope: "account_email profile_nickname"
    });
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider: "kakao",
      providerUserId: "kakao-user",
      email: "kakao@example.com",
      displayName: "Kakao Climber",
      avatarUrl: "https://img.example/kakao.jpg"
    });
    findUserByOAuthIdentityMock.mockResolvedValueOnce(null);

    const request = new NextRequest(`https://granite.kr/api/auth/callback/kakao?code=abc&state=${state.state}`, {
      headers: {
        cookie: `${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state.cookieValue)}`
      }
    });
    const response = await GET(request, { params: Promise.resolve({ provider: "kakao" }) });
    const setCookie = response.headers.get("set-cookie") ?? "";
    const pendingToken = readCookieValue(setCookie, PENDING_SIGNUP_COOKIE_NAME);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/signup");
    expect(readCookieValue(setCookie, USER_SESSION_COOKIE_NAME)).toBeNull();
    await expect(verifyPendingSignupToken(pendingToken ?? "")).resolves.toEqual({
      provider: "kakao",
      providerUserId: "kakao-user",
      email: "kakao@example.com",
      displayName: "Kakao Climber",
      avatarUrl: "https://img.example/kakao.jpg",
      returnTo: "/r/route_1"
    });
  });

  it("returns native Apple form callbacks to the Android SDK without exchanging browser OAuth state", async () => {
    process.env.ANDROID_PACKAGE_NAME = "com.granite.climbing";
    const request = new NextRequest("https://v2.granite.kr/api/auth/callback/apple", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "code=test-code&id_token=test-id-token&state=granite-native-apple-v1.aB3D5eF7gH9jK1mN2pQ4rS6tU8vW0xYz1234567"
    });

    const response = await POST(request, { params: Promise.resolve({ provider: "apple" }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "intent://callback?code=test-code&id_token=test-id-token&state=granite-native-apple-v1.aB3D5eF7gH9jK1mN2pQ4rS6tU8vW0xYz1234567#Intent;package=com.granite.climbing;scheme=signinwithapple;end"
    );
    expect(exchangeOAuthCodeMock).not.toHaveBeenCalled();
  });

  it("rejects a fixed native Apple callback state", async () => {
    const request = new NextRequest("https://v2.granite.kr/api/auth/callback/apple", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "code=test-code&id_token=test-id-token&state=granite-native-apple-v1"
    });

    const response = await POST(request, { params: Promise.resolve({ provider: "apple" }) });

    expect(response.headers.get("location")).toBe("https://v2.granite.kr/login?error=invalid_state");
  });

  it.each([
    "granite-native-apple-v1.too-short",
    "granite-native-apple-v1.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"
  ])("rejects malformed native Apple callback state %s", async (state) => {
    const request = new NextRequest("https://v2.granite.kr/api/auth/callback/apple", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `code=test-code&id_token=test-id-token&state=${state}`
    });

    const response = await POST(request, { params: Promise.resolve({ provider: "apple" }) });

    expect(response.headers.get("location")).toBe("https://v2.granite.kr/login?error=invalid_state");
  });

  it("redirects missing OAuth state cookies with a specific invalid_state error", async () => {
    const request = new NextRequest("https://granite.kr/api/auth/callback/kakao?code=abc&state=missing-cookie");

    const response = await GET(request, { params: Promise.resolve({ provider: "kakao" }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/login?error=invalid_state");
    expect(exchangeOAuthCodeMock).not.toHaveBeenCalled();
  });

  it("redirects token exchange failures with browser-visible diagnostics", async () => {
    process.env.APP_BASE_URL = "https://granite.kr";
    const state = createOAuthState({
      provider: "kakao",
      returnTo: "/me"
    });
    exchangeOAuthCodeMock.mockRejectedValueOnce(
      new Error("OAuth token exchange failed: 400 - invalid_client - client_secret validation failed")
    );
    const request = new NextRequest(`https://granite.kr/api/auth/callback/kakao?code=abc&state=${state.state}`, {
      headers: {
        cookie: `${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state.cookieValue)}`
      }
    });

    const response = await GET(request, { params: Promise.resolve({ provider: "kakao" }) });

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin).toBe("https://granite.kr");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("token_exchange_failed");
    expect(location.searchParams.get("oauth_provider")).toBe("kakao");
    expect(location.searchParams.get("oauth_stage")).toBe("token_exchange_failed");
    expect(location.searchParams.get("oauth_message")).toBe(
      "OAuth token exchange failed: 400 - invalid_client - client_secret validation failed"
    );
    expect(location.href).not.toContain("abc");
    expect(fetchOAuthProfileMock).not.toHaveBeenCalled();
  });

  it("passes the verified callback state to the token exchange", async () => {
    process.env.APP_BASE_URL = "https://granite.kr";
    const state = createOAuthState({
      provider: "naver",
      returnTo: "/me"
    });
    exchangeOAuthCodeMock.mockResolvedValueOnce({
      accessToken: "access-token",
      tokenType: "bearer",
      expiresIn: 3600,
      refreshToken: null,
      idToken: null,
      scope: null
    });
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider: "naver",
      providerUserId: "naver-user",
      email: null,
      displayName: "Naver Climber",
      avatarUrl: null
    });
    findUserByOAuthIdentityMock.mockResolvedValueOnce({
      id: "user_naver",
      email: null,
      displayName: "Naver Climber",
      avatarUrl: null
    });
    const request = new NextRequest(`https://granite.kr/api/auth/callback/naver?code=abc&state=${state.state}`, {
      headers: {
        cookie: `${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state.cookieValue)}`
      }
    });

    await GET(request, { params: Promise.resolve({ provider: "naver" }) });

    expect(exchangeOAuthCodeMock).toHaveBeenCalledWith("naver", {
      code: "abc",
      redirectUri: "https://granite.kr/api/auth/callback/naver",
      state: state.state
    });
  });

  it("redirects profile fetch failures with a specific profile_fetch_failed error", async () => {
    process.env.APP_BASE_URL = "https://granite.kr";
    const state = createOAuthState({
      provider: "kakao",
      returnTo: "/me"
    });
    exchangeOAuthCodeMock.mockResolvedValueOnce({
      accessToken: "access-token",
      tokenType: "Bearer",
      expiresIn: 3600,
      refreshToken: null,
      idToken: null,
      scope: null
    });
    fetchOAuthProfileMock.mockRejectedValueOnce(new Error("profile scope denied"));
    const request = new NextRequest(`https://granite.kr/api/auth/callback/kakao?code=abc&state=${state.state}`, {
      headers: {
        cookie: `${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state.cookieValue)}`
      }
    });

    const response = await GET(request, { params: Promise.resolve({ provider: "kakao" }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/login?error=profile_fetch_failed");
    expect(findUserByOAuthIdentityMock).not.toHaveBeenCalled();
  });
});

function readCookieValue(setCookie: string, name: string): string | null {
  const cookie = setCookie.split(/,\s*/).find((value) => value.startsWith(`${name}=`));
  return cookie?.split(";")[0]?.slice(name.length + 1) ?? null;
}
