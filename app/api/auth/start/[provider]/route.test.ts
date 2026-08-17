import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { OAUTH_STATE_COOKIE_NAME, parseOAuthStateCookie } from "@/lib/auth/oauth/state";
import { GET } from "./route";

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalKakaoClientId = process.env.KAKAO_OAUTH_CLIENT_ID;
const originalKakaoClientSecret = process.env.KAKAO_OAUTH_CLIENT_SECRET;

describe("OAuth start route", () => {
  afterEach(() => {
    process.env.APP_BASE_URL = originalAppBaseUrl;
    process.env.KAKAO_OAUTH_CLIENT_ID = originalKakaoClientId;
    process.env.KAKAO_OAUTH_CLIENT_SECRET = originalKakaoClientSecret;
  });

  it("sets OAuth state and redirects native fallbacks to the provider authorize URL", async () => {
    process.env.APP_BASE_URL = "https://v2.granite.kr";
    process.env.KAKAO_OAUTH_CLIENT_ID = "kakao-client-id";
    process.env.KAKAO_OAUTH_CLIENT_SECRET = "kakao-client-secret";

    const response = await GET(
      new NextRequest("https://v2.granite.kr/api/auth/start/kakao?returnTo=/me&native_fallback=1"),
      { params: Promise.resolve({ provider: "kakao" }) }
    );
    const location = new URL(response.headers.get("location") ?? "");
    const stateCookie = readCookieValue(response.headers.get("set-cookie") ?? "", OAUTH_STATE_COOKIE_NAME);

    expect(response.status).toBe(307);
    expect(location.origin).toBe("https://kauth.kakao.com");
    expect(location.pathname).toBe("/oauth/authorize");
    expect(location.searchParams.get("client_id")).toBe("kakao-client-id");
    expect(location.searchParams.get("redirect_uri")).toBe("https://v2.granite.kr/api/auth/callback/kakao");
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(stateCookie).toBeTruthy();
    expect(parseOAuthStateCookie(stateCookie ?? "")).toMatchObject({
      provider: "kakao",
      returnTo: "/me",
      surface: "flutter-webview"
    });
    expect(location.searchParams.get("prompt")).toBeNull();
  });

  it("starts iOS Kakao system auth with a verifier-bound forced login page", async () => {
    process.env.APP_BASE_URL = "https://v2.granite.kr";
    process.env.KAKAO_OAUTH_CLIENT_ID = "kakao-client-id";
    process.env.KAKAO_OAUTH_CLIENT_SECRET = "kakao-client-secret";
    const challenge = "a".repeat(43);

    const response = await GET(
      new NextRequest(
        `https://v2.granite.kr/api/auth/start/kakao?returnTo=/me&native_system_auth=ios&handoff_challenge=${challenge}`
      ),
      { params: Promise.resolve({ provider: "kakao" }) }
    );
    const location = new URL(response.headers.get("location") ?? "");
    const stateCookie = readCookieValue(response.headers.get("set-cookie") ?? "", OAUTH_STATE_COOKIE_NAME);

    expect(location.origin).toBe("https://kauth.kakao.com");
    expect(location.searchParams.get("prompt")).toBe("login");
    expect(parseOAuthStateCookie(stateCookie ?? "")).toMatchObject({
      provider: "kakao",
      returnTo: "/me",
      surface: "ios-system-auth",
      handoffChallenge: challenge
    });
  });

  it("rejects malformed iOS system auth challenges", async () => {
    process.env.KAKAO_OAUTH_CLIENT_ID = "kakao-client-id";
    process.env.KAKAO_OAUTH_CLIENT_SECRET = "kakao-client-secret";

    const response = await GET(
      new NextRequest(
        "https://v2.granite.kr/api/auth/start/kakao?native_system_auth=ios&handoff_challenge=too-short"
      ),
      { params: Promise.resolve({ provider: "kakao" }) }
    );

    expect(response.headers.get("location")).toBe(
      "https://v2.granite.kr/login?error=invalid_native_auth_request"
    );
  });

  it("redirects unavailable providers back to login", async () => {
    process.env.KAKAO_OAUTH_CLIENT_ID = "";
    process.env.KAKAO_OAUTH_CLIENT_SECRET = "";

    const response = await GET(new NextRequest("https://v2.granite.kr/api/auth/start/kakao"), {
      params: Promise.resolve({ provider: "kakao" })
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://v2.granite.kr/login?error=provider_unavailable");
  });
});

function readCookieValue(setCookie: string, name: string): string | null {
  const cookie = setCookie.split(/,\s*/).find((value) => value.startsWith(`${name}=`));
  return cookie?.split(";")[0]?.slice(name.length + 1) ?? null;
}
