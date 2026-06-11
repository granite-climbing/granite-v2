import { afterEach, describe, expect, it } from "vitest";
import { getAppBaseUrl, getOAuthRedirectUri } from "./url";

const originalAppBaseUrl = process.env.APP_BASE_URL;
const originalVercelUrl = process.env.VERCEL_URL;

describe("OAuth URL helpers", () => {
  afterEach(() => {
    process.env.APP_BASE_URL = originalAppBaseUrl;
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
});
