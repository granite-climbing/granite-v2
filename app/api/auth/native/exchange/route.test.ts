import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyNativeAuthHandoffToken } from "@/lib/auth/native-handoff";
import { POST } from "./route";

const fetchOAuthProfileMock = vi.hoisted(() => vi.fn());
const findUserByOAuthIdentityMock = vi.hoisted(() => vi.fn());
const storeNativeAuthHandoffTokenMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/oauth/client", () => ({
  fetchOAuthProfile: fetchOAuthProfileMock
}));

vi.mock("@/lib/db/user-auth-queries", () => ({
  findUserByOAuthIdentity: findUserByOAuthIdentityMock
}));

vi.mock("@/lib/db/native-auth-handoffs", () => ({
  storeNativeAuthHandoffToken: storeNativeAuthHandoffTokenMock
}));

const originalJwtSecret = process.env.JWT_SECRET;

describe("native auth exchange route", () => {
  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
    fetchOAuthProfileMock.mockReset();
    findUserByOAuthIdentityMock.mockReset();
    storeNativeAuthHandoffTokenMock.mockReset();
  });

  it("returns a handoff code for an existing Kakao user", async () => {
    process.env.JWT_SECRET = "native-exchange-test-secret";
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider: "kakao",
      providerUserId: "kakao-user",
      email: "kakao@example.com",
      displayName: "Kakao Climber",
      avatarUrl: null
    });
    findUserByOAuthIdentityMock.mockResolvedValueOnce({
      id: "user_kakao"
    });
    storeNativeAuthHandoffTokenMock.mockResolvedValueOnce("handoff-code");

    const response = await POST(jsonRequest({
      provider: "kakao",
      accessToken: "kakao-access-token",
      returnTo: "/me"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      handoffCode: "handoff-code",
      returnTo: "/me"
    });
    expect(fetchOAuthProfileMock).toHaveBeenCalledWith("kakao", {
      accessToken: "kakao-access-token",
      idToken: null
    });
    expect(findUserByOAuthIdentityMock).toHaveBeenCalledWith("kakao", "kakao-user");
    const storedToken = storeNativeAuthHandoffTokenMock.mock.calls[0][0];
    await expect(verifyNativeAuthHandoffToken(storedToken)).resolves.toEqual({
      kind: "session",
      userId: "user_kakao",
      returnTo: "/me"
    });
  });

  it("returns a signup handoff for a first-time Naver user", async () => {
    process.env.JWT_SECRET = "native-exchange-test-secret";
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider: "naver",
      providerUserId: "naver-user",
      email: null,
      displayName: "Naver Climber",
      avatarUrl: "https://img.example/naver.jpg"
    });
    findUserByOAuthIdentityMock.mockResolvedValueOnce(null);
    storeNativeAuthHandoffTokenMock.mockResolvedValueOnce("signup-handoff-code");

    const response = await POST(jsonRequest({
      provider: "naver",
      accessToken: "naver-access-token",
      returnTo: "/r/route_1"
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      handoffCode: "signup-handoff-code",
      returnTo: "/r/route_1"
    });
    const storedToken = storeNativeAuthHandoffTokenMock.mock.calls[0][0];
    await expect(verifyNativeAuthHandoffToken(storedToken)).resolves.toEqual({
      kind: "signup",
      provider: "naver",
      providerUserId: "naver-user",
      email: null,
      displayName: "Naver Climber",
      avatarUrl: "https://img.example/naver.jpg",
      returnTo: "/r/route_1"
    });
  });

  it.each([
    ["google", "google-id-token"],
    ["apple", "apple-id-token"]
  ] as const)("accepts a native %s id token", async (provider, idToken) => {
    process.env.JWT_SECRET = "native-exchange-test-secret";
    fetchOAuthProfileMock.mockResolvedValueOnce({
      provider,
      providerUserId: `${provider}-user`,
      email: null,
      displayName: `${provider} Climber`,
      avatarUrl: null
    });
    findUserByOAuthIdentityMock.mockResolvedValueOnce({
      id: `user_${provider}`
    });
    storeNativeAuthHandoffTokenMock.mockResolvedValueOnce("handoff-code");

    const response = await POST(jsonRequest({
      provider,
      idToken,
      returnTo: "/me"
    }));

    expect(response.status).toBe(200);
    expect(fetchOAuthProfileMock).toHaveBeenCalledWith(provider, {
      accessToken: "",
      idToken
    });
  });

  it("rejects unsupported native providers", async () => {
    const response = await POST(jsonRequest({
      provider: "email",
      accessToken: "email-access-token",
      returnTo: "/me"
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "unsupported_provider"
    });
    expect(fetchOAuthProfileMock).not.toHaveBeenCalled();
  });

  it("rejects provider profile failures without logging the token", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchOAuthProfileMock.mockRejectedValueOnce(new Error("provider down"));

    const response = await POST(jsonRequest({
      provider: "kakao",
      accessToken: "secret-access-token",
      returnTo: "/me"
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "native_profile_failed"
    });
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain("secret-access-token");
    consoleErrorSpy.mockRestore();
  });
});

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("https://granite.kr/api/auth/native/exchange", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json"
    }
  });
}
