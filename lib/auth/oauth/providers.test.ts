import { afterEach, describe, expect, it } from "vitest";
import { buildAuthorizationUrl, getOAuthProvider, isOAuthProvider, isOAuthProviderConfigured } from "./providers";

const originalEnv = { ...process.env };

describe("OAuth provider configuration", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds a Google authorization URL with only the OpenID identity scope", () => {
    const url = buildAuthorizationUrl("google", {
      redirectUri: "https://granite.kr/api/auth/callback/google",
      state: "state-123",
      nonce: "nonce-123"
    });

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("");
    expect(url.searchParams.get("redirect_uri")).toBe("https://granite.kr/api/auth/callback/google");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("nonce")).toBe("nonce-123");
    expect(url.searchParams.get("scope")).toBe("openid");
  });

  it("uses a query callback for Apple when no profile scopes are requested", () => {
    process.env.APPLE_WEB_CLIENT_ID = "kr.granite.web";
    const provider = getOAuthProvider("apple");
    const url = buildAuthorizationUrl("apple", {
      redirectUri: "https://granite.kr/api/auth/callback/apple",
      state: "apple-state",
      nonce: "apple-nonce"
    });

    expect(provider.provider).toBe("apple");
    expect(url.searchParams.get("client_id")).toBe("kr.granite.web");
    expect(url.searchParams.get("response_mode")).toBe("query");
    expect(url.searchParams.get("scope")).toBeNull();
  });

  it("does not request optional Kakao or Naver profile fields during authorization", () => {
    const kakaoUrl = buildAuthorizationUrl("kakao", {
      redirectUri: "https://granite.kr/api/auth/callback/kakao",
      state: "kakao-state",
      nonce: "kakao-nonce"
    });
    const naverUrl = buildAuthorizationUrl("naver", {
      redirectUri: "https://granite.kr/api/auth/callback/naver",
      state: "naver-state",
      nonce: "naver-nonce"
    });

    expect(kakaoUrl.searchParams.get("scope")).toBeNull();
    expect(naverUrl.searchParams.get("scope")).toBeNull();
  });

  it("recognizes only supported Phase 6 providers", () => {
    expect(isOAuthProvider("kakao")).toBe(true);
    expect(isOAuthProvider("naver")).toBe(true);
    expect(isOAuthProvider("google")).toBe(true);
    expect(isOAuthProvider("apple")).toBe(true);
    expect(isOAuthProvider("github")).toBe(false);
  });

  it("reports whether a provider has the required local environment", () => {
    process.env.KAKAO_OAUTH_CLIENT_ID = "kakao-id";
    process.env.KAKAO_OAUTH_CLIENT_SECRET = "kakao-secret";
    process.env.NAVER_OAUTH_CLIENT_ID = "naver-id";
    process.env.NAVER_OAUTH_CLIENT_SECRET = "naver-secret";
    process.env.GOOGLE_OAUTH_CLIENT_ID = "";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "";
    process.env.APPLE_CLIENT_ID = "";
    process.env.APPLE_WEB_CLIENT_ID = "";
    process.env.APPLE_IOS_CLIENT_ID = "";
    process.env.APPLE_CLIENT_SECRET = "";

    expect(isOAuthProviderConfigured(getOAuthProvider("kakao"))).toBe(true);
    expect(isOAuthProviderConfigured(getOAuthProvider("naver"))).toBe(true);
    expect(isOAuthProviderConfigured(getOAuthProvider("google"))).toBe(false);
    expect(isOAuthProviderConfigured(getOAuthProvider("apple"))).toBe(false);
  });

  it("uses the legacy Apple client id only when the web Services ID is not configured", () => {
    process.env.APPLE_WEB_CLIENT_ID = "";
    process.env.APPLE_CLIENT_ID = "legacy.apple.service";

    const url = buildAuthorizationUrl("apple", {
      redirectUri: "https://granite.kr/api/auth/callback/apple",
      state: "apple-state",
      nonce: "apple-nonce"
    });

    expect(url.searchParams.get("client_id")).toBe("legacy.apple.service");
  });
});
