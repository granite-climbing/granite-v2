import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PENDING_SIGNUP_COOKIE_NAME, verifyPendingSignupToken } from "@/lib/auth/signup";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { POST } from "./route";

const fetchOAuthProfileMock = vi.hoisted(() => vi.fn());
const findUserByOAuthIdentityMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/oauth/client", () => ({
  fetchOAuthProfile: fetchOAuthProfileMock
}));

vi.mock("@/lib/db/user-auth-queries", () => ({
  findUserByOAuthIdentity: findUserByOAuthIdentityMock
}));

const originalJwtSecret = process.env.JWT_SECRET;

describe("native auth session route", () => {
  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    fetchOAuthProfileMock.mockReset();
    findUserByOAuthIdentityMock.mockReset();
  });

  it("sets a Granite session cookie from a native Apple id token", async () => {
    process.env.JWT_SECRET = "native-session-test-secret";
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider: "apple",
      providerUserId: "apple-user",
      email: null,
      displayName: "Apple Climber",
      avatarUrl: null
    });
    findUserByOAuthIdentityMock.mockResolvedValueOnce({
      id: "user_apple"
    });

    const response = await POST(formRequest({
      provider: "apple",
      idToken: "apple-id-token",
      returnTo: "/me"
    }));
    const setCookie = response.headers.get("set-cookie") ?? "";
    const sessionToken = readCookieValue(setCookie, USER_SESSION_COOKIE_NAME);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://granite.kr/me");
    expect(fetchOAuthProfileMock).toHaveBeenCalledWith("apple", {
      accessToken: "",
      idToken: "apple-id-token"
    });
    expect(findUserByOAuthIdentityMock).toHaveBeenCalledWith("apple", "apple-user");
    await expect(verifyUserSessionToken(sessionToken ?? "")).resolves.toEqual({
      userId: "user_apple"
    });
  });

  it("sets a pending signup cookie for a first-time native provider user", async () => {
    process.env.JWT_SECRET = "native-session-test-secret";
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider: "kakao",
      providerUserId: "kakao-user",
      email: "kakao@example.com",
      displayName: "Kakao Climber",
      avatarUrl: null
    });
    findUserByOAuthIdentityMock.mockResolvedValueOnce(null);

    const response = await POST(formRequest({
      provider: "kakao",
      accessToken: "kakao-access-token",
      returnTo: "/routes/route_1"
    }));
    const setCookie = response.headers.get("set-cookie") ?? "";
    const pendingToken = readCookieValue(setCookie, PENDING_SIGNUP_COOKIE_NAME);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://granite.kr/signup");
    await expect(verifyPendingSignupToken(pendingToken ?? "")).resolves.toEqual({
      provider: "kakao",
      providerUserId: "kakao-user",
      email: "kakao@example.com",
      displayName: "Kakao Climber",
      avatarUrl: null,
      returnTo: "/routes/route_1"
    });
  });

  it("redirects invalid native session requests back to login", async () => {
    const response = await POST(formRequest({
      provider: "apple",
      returnTo: "https://evil.example/me"
    }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://granite.kr/login?error=missing_provider_token"
    );
    expect(fetchOAuthProfileMock).not.toHaveBeenCalled();
  });
});

function formRequest(body: Record<string, string>): NextRequest {
  return new NextRequest("https://granite.kr/api/auth/native/session", {
    method: "POST",
    body: new URLSearchParams(body),
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    }
  });
}

function readCookieValue(setCookie: string, name: string): string | null {
  const cookie = setCookie.split(/,\s*/).find((value) => value.startsWith(`${name}=`));
  return cookie?.split(";")[0]?.slice(name.length + 1) ?? null;
}
