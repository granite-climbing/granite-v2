import { afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { exchangeOAuthCode, fetchOAuthProfile } from "./client";

const originalEnv = {
  APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID,
  APPLE_WEB_CLIENT_ID: process.env.APPLE_WEB_CLIENT_ID,
  APPLE_IOS_CLIENT_ID: process.env.APPLE_IOS_CLIENT_ID
};

describe("OAuth HTTP client", () => {
  afterEach(() => {
    process.env.APPLE_CLIENT_ID = originalEnv.APPLE_CLIENT_ID;
    process.env.APPLE_WEB_CLIENT_ID = originalEnv.APPLE_WEB_CLIENT_ID;
    process.env.APPLE_IOS_CLIENT_ID = originalEnv.APPLE_IOS_CLIENT_ID;
  });

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
          expires_in: "3600"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const tokenSet = await exchangeOAuthCode("naver", {
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
    expect(tokenSet.expiresIn).toBe(3600);
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

  it("normalizes a Google profile from a native id token when no access token is provided", async () => {
    const profile = await fetchOAuthProfile("google", {
      accessToken: "",
      idToken: unsignedJwt({
        sub: "native-google-user",
        email: "native-google@example.com",
        name: "Native Google Climber"
      }),
      fetchImpl: vi.fn()
    });

    expect(profile).toMatchObject({
      provider: "google",
      providerUserId: "native-google-user",
      email: "native-google@example.com",
      displayName: "Native Google Climber"
    });
  });

  it("accepts Apple native id tokens for the configured iOS app audience", async () => {
    process.env.APPLE_WEB_CLIENT_ID = "kr.granite.web";
    process.env.APPLE_IOS_CLIENT_ID = "com.granite.climbing";
    const { privateKey, publicKey } = await generateKeyPair("ES256");

    const profile = await fetchOAuthProfile("apple", {
      accessToken: "",
      idToken: await signedJwt(privateKey, {
        iss: "https://appleid.apple.com",
        aud: "com.granite.climbing",
        sub: "apple-user",
        email: "apple@example.com"
      }),
      appleVerifyKey: async () => publicKey,
      fetchImpl: vi.fn()
    });

    expect(profile).toMatchObject({
      provider: "apple",
      providerUserId: "apple-user",
      email: "apple@example.com"
    });
  });

  it("rejects Apple id tokens for unknown audiences", async () => {
    process.env.APPLE_WEB_CLIENT_ID = "kr.granite.web";
    process.env.APPLE_IOS_CLIENT_ID = "com.granite.climbing";
    const { privateKey, publicKey } = await generateKeyPair("ES256");

    await expect(
      fetchOAuthProfile("apple", {
        accessToken: "",
        idToken: await signedJwt(privateKey, {
          iss: "https://appleid.apple.com",
          aud: "other.client",
          sub: "apple-user"
        }),
        appleVerifyKey: async () => publicKey,
        fetchImpl: vi.fn()
      })
    ).rejects.toThrow("unexpected \"aud\" claim value");
  });
});

function unsignedJwt(payload: Record<string, unknown>): string {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    ""
  ].join(".");
}

async function signedJwt(
  privateKey: CryptoKey,
  payload: Record<string, unknown>
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256" })
    .sign(privateKey);
}
