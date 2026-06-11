import { describe, expect, it } from "vitest";
import { buildAuthorizationUrl, getOAuthProvider, isOAuthProvider } from "./providers";

describe("OAuth provider configuration", () => {
  it("builds a Google authorization URL with state, nonce, and the callback URL", () => {
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
    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });

  it("keeps Apple configured for form_post callbacks", () => {
    const provider = getOAuthProvider("apple");
    const url = buildAuthorizationUrl("apple", {
      redirectUri: "https://granite.kr/api/auth/callback/apple",
      state: "apple-state",
      nonce: "apple-nonce"
    });

    expect(provider.provider).toBe("apple");
    expect(url.searchParams.get("response_mode")).toBe("form_post");
    expect(url.searchParams.get("scope")).toBe("name email");
  });

  it("recognizes only supported Phase 5 providers", () => {
    expect(isOAuthProvider("kakao")).toBe(true);
    expect(isOAuthProvider("naver")).toBe(true);
    expect(isOAuthProvider("google")).toBe(true);
    expect(isOAuthProvider("apple")).toBe(true);
    expect(isOAuthProvider("github")).toBe(false);
  });
});
