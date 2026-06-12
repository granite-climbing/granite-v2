import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createNativeAuthHandoffToken } from "@/lib/auth/native-handoff";
import { PENDING_SIGNUP_COOKIE_NAME, verifyPendingSignupToken } from "@/lib/auth/signup";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { GET } from "./route";

const consumeNativeAuthHandoffTokenMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/native-auth-handoffs", () => ({
  consumeNativeAuthHandoffToken: consumeNativeAuthHandoffTokenMock
}));

const originalJwtSecret = process.env.JWT_SECRET;

describe("native auth consume route", () => {
  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    consumeNativeAuthHandoffTokenMock.mockReset();
  });

  it("sets a Granite session cookie for a session handoff", async () => {
    process.env.JWT_SECRET = "native-consume-test-secret";
    const token = await createNativeAuthHandoffToken({
      kind: "session",
      userId: "user_kakao",
      returnTo: "/me"
    });
    consumeNativeAuthHandoffTokenMock.mockResolvedValueOnce(token);

    const response = await GET(new NextRequest("https://granite.kr/api/auth/native/consume?code=handoff-code"));
    const setCookie = response.headers.get("set-cookie") ?? "";
    const sessionToken = readCookieValue(setCookie, USER_SESSION_COOKIE_NAME);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/me");
    expect(consumeNativeAuthHandoffTokenMock).toHaveBeenCalledWith("handoff-code");
    await expect(verifyUserSessionToken(sessionToken ?? "")).resolves.toEqual({
      userId: "user_kakao"
    });
  });

  it("sets a pending signup cookie for a signup handoff", async () => {
    process.env.JWT_SECRET = "native-consume-test-secret";
    const token = await createNativeAuthHandoffToken({
      kind: "signup",
      provider: "naver",
      providerUserId: "naver-user",
      email: "naver@example.com",
      displayName: "Naver Climber",
      avatarUrl: null,
      returnTo: "/r/route_1"
    });
    consumeNativeAuthHandoffTokenMock.mockResolvedValueOnce(token);

    const response = await GET(new NextRequest("https://granite.kr/api/auth/native/consume?code=signup-code"));
    const setCookie = response.headers.get("set-cookie") ?? "";
    const pendingToken = readCookieValue(setCookie, PENDING_SIGNUP_COOKIE_NAME);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://granite.kr/signup");
    await expect(verifyPendingSignupToken(pendingToken ?? "")).resolves.toEqual({
      provider: "naver",
      providerUserId: "naver-user",
      email: "naver@example.com",
      displayName: "Naver Climber",
      avatarUrl: null,
      returnTo: "/r/route_1"
    });
  });

  it("redirects invalid or consumed handoff codes back to login", async () => {
    consumeNativeAuthHandoffTokenMock.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest("https://granite.kr/api/auth/native/consume?code=bad-code"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://granite.kr/login?error=native_handoff_failed"
    );
  });
});

function readCookieValue(setCookie: string, name: string): string | null {
  const cookie = setCookie.split(/,\s*/).find((value) => value.startsWith(`${name}=`));
  return cookie?.split(";")[0]?.slice(name.length + 1) ?? null;
}
