import { afterEach, describe, expect, it } from "vitest";
import { getAppBaseUrl, getOAuthRedirectUri, getOAuthRequestOrigin, resolveAllowedOAuthOrigin } from "./url";

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalOAuthAllowedOrigins = process.env.OAUTH_ALLOWED_ORIGINS;
const originalVercelUrl = process.env.VERCEL_URL;

describe("OAuth URL helpers", () => {
  afterEach(() => {
    process.env.APP_BASE_URL = originalAppBaseUrl;
    process.env.OAUTH_ALLOWED_ORIGINS = originalOAuthAllowedOrigins;
    process.env.VERCEL_URL = originalVercelUrl;
  });

  it("uses APP_BASE_URL when configured", () => {
    process.env.APP_BASE_URL = "https://granite.kr/";
    process.env.VERCEL_URL = "";

    expect(getAppBaseUrl()).toBe("https://granite.kr");
    expect(getOAuthRedirectUri("kakao")).toBe("https://granite.kr/api/auth/callback/kakao");
  });

  it("falls back to VERCEL_URL and then local dev", () => {
    process.env.APP_BASE_URL = "";
    process.env.VERCEL_URL = "granite-preview.vercel.app";

    expect(getAppBaseUrl()).toBe("https://granite-preview.vercel.app");

    process.env.VERCEL_URL = "";
    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("allows redirect URI generation from the current request origin", () => {
    process.env.APP_BASE_URL = "https://v2.granite.kr";
    process.env.OAUTH_ALLOWED_ORIGINS = "https://v2.granite.kr, https://v2-preview.granite.kr";

    const origin = resolveAllowedOAuthOrigin("https://v2-preview.granite.kr/");

    expect(origin).toBe("https://v2-preview.granite.kr");
    expect(getOAuthRedirectUri("google", origin ?? undefined)).toBe(
      "https://v2-preview.granite.kr/api/auth/callback/google"
    );
  });

  it("rejects request origins that are not explicitly allowed", () => {
    process.env.APP_BASE_URL = "https://v2.granite.kr";
    process.env.OAUTH_ALLOWED_ORIGINS = "https://v2.granite.kr, https://v2-preview.granite.kr";

    expect(resolveAllowedOAuthOrigin("https://attacker.example")).toBeNull();
  });

  it("resolves localhost request origins as http when no forwarded protocol exists", () => {
    const origin = getOAuthRequestOrigin(
      new Headers({
        host: "localhost:3000"
      })
    );

    expect(origin).toBe("http://localhost:3000");
    expect(resolveAllowedOAuthOrigin(origin)).toBe("http://localhost:3000");
  });
});
