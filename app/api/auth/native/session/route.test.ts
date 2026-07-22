import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PENDING_RECOVERY_COOKIE_NAME, verifyPendingRecoveryToken } from "@/lib/auth/recovery";
import { PENDING_SIGNUP_COOKIE_NAME, verifyPendingSignupToken } from "@/lib/auth/signup";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { POST } from "./route";

const fetchOAuthProfileMock = vi.hoisted(() => vi.fn());
const resolveOAuthLoginMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/oauth/client", () => ({
  fetchOAuthProfile: fetchOAuthProfileMock
}));

vi.mock("@/lib/auth/login-resolution", () => ({
  resolveOAuthLogin: resolveOAuthLoginMock
}));

const originalJwtSecret = process.env.JWT_SECRET;

describe("native auth session route", () => {
  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    fetchOAuthProfileMock.mockReset();
    resolveOAuthLoginMock.mockReset();
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
    resolveOAuthLoginMock.mockResolvedValueOnce({
      kind: "session",
      user: { id: "user_apple" }
    });

    const response = await POST(formRequest({
      provider: "apple",
      idToken: "apple-id-token",
      returnTo: "/me"
    }));
    const setCookie = response.headers.get("set-cookie") ?? "";
    const sessionToken = readCookieValue(setCookie, USER_SESSION_COOKIE_NAME);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("location.replace(\"/me\")");
    expect(fetchOAuthProfileMock).toHaveBeenCalledWith("apple", {
      accessToken: "",
      idToken: "apple-id-token"
    });
    expect(resolveOAuthLoginMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "apple", providerUserId: "apple-user" }),
      expect.any(Date)
    );
    await expect(verifyUserSessionToken(sessionToken ?? "")).resolves.toEqual({
      userId: "user_apple"
    });
  });

  it("탈퇴 유예 계정은 복구 쿠키를 심고 /recover 로 이동시킨다", async () => {
    process.env.JWT_SECRET = "native-session-test-secret";
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider: "apple",
      providerUserId: "apple-user",
      email: null,
      displayName: "Apple Climber",
      avatarUrl: null
    });
    resolveOAuthLoginMock.mockResolvedValueOnce({
      kind: "recover",
      user: { id: "user_apple" }
    });

    const response = await POST(
      formRequest({ provider: "apple", idToken: "apple-id-token", returnTo: "/me" })
    );
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("location.replace(\"/recover\")");
    expect(readCookieValue(setCookie, USER_SESSION_COOKIE_NAME)).toBeNull();

    const recoveryToken = readCookieValue(setCookie, PENDING_RECOVERY_COOKIE_NAME);
    await expect(verifyPendingRecoveryToken(recoveryToken ?? "")).resolves.toEqual({
      userId: "user_apple",
      returnTo: "/me"
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
    resolveOAuthLoginMock.mockResolvedValueOnce({ kind: "signup" });

    const response = await POST(formRequest({
      provider: "kakao",
      accessToken: "kakao-access-token",
      returnTo: "/routes/route_1"
    }));
    const setCookie = response.headers.get("set-cookie") ?? "";
    const pendingToken = readCookieValue(setCookie, PENDING_SIGNUP_COOKIE_NAME);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("location.replace(\"/signup\")");
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
