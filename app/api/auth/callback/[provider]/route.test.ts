import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createOAuthState, OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/oauth/state";
import { PENDING_SIGNUP_COOKIE_NAME, verifyPendingSignupToken } from "@/lib/auth/signup";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { GET } from "./route";

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

describe("OAuth callback route", () => {
  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.APP_BASE_URL = originalAppBaseUrl;
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
      redirectUri: "https://granite.kr/api/auth/callback/google"
    });
    expect(findUserByOAuthIdentityMock).toHaveBeenCalledWith("google", "google-user");
    await expect(verifyUserSessionToken(sessionToken ?? "")).resolves.toEqual({
      userId: "user_google"
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

  it("redirects missing OAuth state cookies with a specific invalid_state error", async () => {
    const request = new NextRequest("https://granite.kr/api/auth/callback/kakao?code=abc&state=missing-cookie");

    const response = await GET(request, { params: Promise.resolve({ provider: "kakao" }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/login?error=invalid_state");
    expect(exchangeOAuthCodeMock).not.toHaveBeenCalled();
  });

  it("redirects token exchange failures with a specific token_exchange_failed error", async () => {
    process.env.APP_BASE_URL = "https://granite.kr";
    const state = createOAuthState({
      provider: "kakao",
      returnTo: "/me"
    });
    exchangeOAuthCodeMock.mockRejectedValueOnce(new Error("bad redirect_uri"));
    const request = new NextRequest(`https://granite.kr/api/auth/callback/kakao?code=abc&state=${state.state}`, {
      headers: {
        cookie: `${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state.cookieValue)}`
      }
    });

    const response = await GET(request, { params: Promise.resolve({ provider: "kakao" }) });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/login?error=token_exchange_failed");
    expect(fetchOAuthProfileMock).not.toHaveBeenCalled();
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
