import { describe, expect, it, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { createAppWebSessionHandoffToken } from "@/lib/auth/app-handoff";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { GET } from "./route";

const originalJwtSecret = process.env.JWT_SECRET;

describe("app handoff route", () => {
  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it("exchanges a valid app handoff code for a Granite web session cookie", async () => {
    process.env.JWT_SECRET = "app-handoff-route-test-secret";
    const code = await createAppWebSessionHandoffToken({
      userId: "user_app_1",
      returnTo: "/me"
    });
    const request = new NextRequest(`https://granite.kr/api/auth/app-handoff?code=${code}`);

    const response = await GET(request);
    const setCookie = response.headers.get("set-cookie") ?? "";
    const sessionToken = readCookieValue(setCookie, USER_SESSION_COOKIE_NAME);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/me");
    await expect(verifyUserSessionToken(sessionToken ?? "")).resolves.toEqual({
      userId: "user_app_1"
    });
  });

  it("allows a safe request return path to override the token return path", async () => {
    process.env.JWT_SECRET = "app-handoff-route-test-secret";
    const code = await createAppWebSessionHandoffToken({
      userId: "user_app_1",
      returnTo: "/me"
    });
    const request = new NextRequest(`https://granite.kr/api/auth/app-handoff?code=${code}&returnTo=/r/route_1`);

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/r/route_1");
  });

  it("falls back to the token return path when the request return path is unsafe", async () => {
    process.env.JWT_SECRET = "app-handoff-route-test-secret";
    const code = await createAppWebSessionHandoffToken({
      userId: "user_app_1",
      returnTo: "/me"
    });
    const request = new NextRequest(
      `https://granite.kr/api/auth/app-handoff?code=${code}&returnTo=https://example.com/phish`
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/me");
  });

  it("redirects invalid handoff codes back to login", async () => {
    const request = new NextRequest("https://granite.kr/api/auth/app-handoff?code=bad");

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/login?error=invalid_app_handoff");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

function readCookieValue(setCookie: string, name: string): string | null {
  const cookie = setCookie.split(/,\s*/).find((value) => value.startsWith(`${name}=`));
  return cookie?.split(";")[0]?.slice(name.length + 1) ?? null;
}
