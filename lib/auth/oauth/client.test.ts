import { describe, expect, it, vi } from "vitest";
import { exchangeOAuthCode, fetchOAuthProfile } from "./client";

describe("OAuth HTTP client", () => {
  it("exchanges an authorization code with provider token endpoints", async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-secret";
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          access_token: "access-token",
          token_type: "Bearer",
          expires_in: 3600,
          id_token: "id-token",
          scope: "openid email profile"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const tokenSet = await exchangeOAuthCode("google", {
      code: "oauth-code",
      redirectUri: "https://granite.kr/api/auth/callback/google",
      fetchImpl
    });

    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    expect(fetchImpl).toHaveBeenCalledWith("https://oauth2.googleapis.com/token", expect.any(Object));
    expect(String(requestBody)).toContain("grant_type=authorization_code");
    expect(String(requestBody)).toContain("client_id=google-client");
    expect(String(requestBody)).toContain("client_secret=google-secret");
    expect(tokenSet.accessToken).toBe("access-token");
  });

  it("includes the callback state when exchanging a Naver authorization code", async () => {
    process.env.NAVER_OAUTH_CLIENT_ID = "naver-client";
    process.env.NAVER_OAUTH_CLIENT_SECRET = "naver-secret";
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          access_token: "naver-access-token",
          token_type: "bearer",
          expires_in: 3600
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    await exchangeOAuthCode("naver", {
      code: "naver-oauth-code",
      redirectUri: "https://granite.kr/api/auth/callback/naver",
      state: "naver-callback-state",
      fetchImpl
    });

    const requestBody = fetchImpl.mock.calls[0]?.[1]?.body;
    expect(String(requestBody)).toContain("client_id=naver-client");
    expect(String(requestBody)).toContain("client_secret=naver-secret");
    expect(String(requestBody)).toContain("code=naver-oauth-code");
    expect(String(requestBody)).toContain("state=naver-callback-state");
  });

  it("fetches and normalizes a provider profile", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          sub: "google-user",
          email: "google@example.com",
          name: "Google Climber"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const profile = await fetchOAuthProfile("google", {
      accessToken: "access-token",
      idToken: "id-token",
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://openidconnect.googleapis.com/v1/userinfo",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer access-token" })
      })
    );
    expect(profile).toMatchObject({
      provider: "google",
      providerUserId: "google-user",
      email: "google@example.com"
    });
  });
});
