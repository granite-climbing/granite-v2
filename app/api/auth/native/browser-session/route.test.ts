import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  createNativeBrowserChallenge,
  createNativeBrowserHandoff
} from "@/lib/auth/native-browser-handoff";
import { PENDING_RECOVERY_COOKIE_NAME, verifyPendingRecoveryToken } from "@/lib/auth/recovery";
import { PENDING_SIGNUP_COOKIE_NAME, verifyPendingSignupToken } from "@/lib/auth/signup";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { POST } from "./route";

const originalJwtSecret = process.env.JWT_SECRET;
const verifier = "ios-native-browser-session-verifier";
const challenge = createNativeBrowserChallenge(verifier);

describe("native browser session route", () => {
  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it("sets the existing Granite session cookie from a verified handoff", async () => {
    process.env.JWT_SECRET = "browser-session-test-secret";
    const handoff = await createNativeBrowserHandoff({
      kind: "session",
      userId: "user-kakao",
      returnTo: "/me",
      challenge
    });

    const response = await POST(formRequest({ handoff, verifier }));
    const setCookie = response.headers.get("set-cookie") ?? "";
    const sessionToken = readCookieValue(setCookie, USER_SESSION_COOKIE_NAME);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain('location.replace("/me")');
    await expect(verifyUserSessionToken(sessionToken ?? "")).resolves.toEqual({
      userId: "user-kakao"
    });
  });

  it("sets the existing pending signup cookie from a verified handoff", async () => {
    process.env.JWT_SECRET = "browser-session-test-secret";
    const handoff = await createNativeBrowserHandoff({
      kind: "signup",
      provider: "kakao",
      providerUserId: "kakao-user",
      email: "kakao@example.com",
      displayName: "Kakao Climber",
      avatarUrl: null,
      returnTo: "/routes/route-1",
      challenge
    });

    const response = await POST(formRequest({ handoff, verifier }));
    const pendingToken = readCookieValue(
      response.headers.get("set-cookie") ?? "",
      PENDING_SIGNUP_COOKIE_NAME
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('location.replace("/signup")');
    await expect(verifyPendingSignupToken(pendingToken ?? "")).resolves.toEqual({
      provider: "kakao",
      providerUserId: "kakao-user",
      email: "kakao@example.com",
      displayName: "Kakao Climber",
      avatarUrl: null,
      returnTo: "/routes/route-1"
    });
  });

  it("sets the existing pending recovery cookie from a verified handoff", async () => {
    process.env.JWT_SECRET = "browser-session-test-secret";
    const handoff = await createNativeBrowserHandoff({
      kind: "recover",
      userId: "user-kakao",
      returnTo: "/me",
      challenge
    });

    const response = await POST(formRequest({ handoff, verifier }));
    const pendingToken = readCookieValue(
      response.headers.get("set-cookie") ?? "",
      PENDING_RECOVERY_COOKIE_NAME
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('location.replace("/recover")');
    await expect(verifyPendingRecoveryToken(pendingToken ?? "")).resolves.toEqual({
      userId: "user-kakao",
      returnTo: "/me"
    });
  });

  it.each([
    { handoff: "malformed", verifier },
    { handoff: "", verifier: "" }
  ])("rejects an invalid handoff without setting auth cookies", async (body) => {
    const response = await POST(formRequest(body));
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://granite.kr/login?error=native_browser_session_failed"
    );
    expect(readCookieValue(setCookie, USER_SESSION_COOKIE_NAME)).toBeNull();
    expect(readCookieValue(setCookie, PENDING_SIGNUP_COOKIE_NAME)).toBeNull();
    expect(readCookieValue(setCookie, PENDING_RECOVERY_COOKIE_NAME)).toBeNull();
  });

  it("rejects a handoff redeemed with another login attempt's verifier", async () => {
    process.env.JWT_SECRET = "browser-session-test-secret";
    const handoff = await createNativeBrowserHandoff({
      kind: "session",
      userId: "user-kakao",
      returnTo: "/me",
      challenge
    });

    const response = await POST(
      formRequest({ handoff, verifier: "another-ios-login-attempt-verifier" })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://granite.kr/login?error=native_browser_session_failed"
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

function formRequest(body: Record<string, string>): NextRequest {
  return new NextRequest("https://granite.kr/api/auth/native/browser-session", {
    method: "POST",
    body: new URLSearchParams(body),
    headers: { "content-type": "application/x-www-form-urlencoded" }
  });
}

function readCookieValue(setCookie: string, name: string): string | null {
  const cookie = setCookie.split(/,\s*/).find((value) => value.startsWith(`${name}=`));
  return cookie?.split(";")[0]?.slice(name.length + 1) ?? null;
}
