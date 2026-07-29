import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { createUserSessionToken, getUserSessionSecret } from "./session";
import {
  createPendingRecoveryToken,
  getPendingRecoveryCookieOptions,
  PENDING_RECOVERY_COOKIE_NAME,
  verifyPendingRecoveryToken
} from "./recovery";

describe("pending recovery token", () => {
  it("발급한 토큰을 되읽는다", async () => {
    const token = await createPendingRecoveryToken({ userId: "user_1", returnTo: "/me/records" });

    expect(await verifyPendingRecoveryToken(token)).toEqual({
      userId: "user_1",
      returnTo: "/me/records"
    });
  });

  it("외부 절대 URL 인 returnTo 는 /me 로 떨어뜨린다", async () => {
    const token = await createPendingRecoveryToken({
      userId: "user_1",
      returnTo: "//evil.example.com"
    });

    expect(await verifyPendingRecoveryToken(token)).toEqual({ userId: "user_1", returnTo: "/me" });
  });

  it("변조된 토큰은 null", async () => {
    const token = await createPendingRecoveryToken({ userId: "user_1", returnTo: "/me" });

    expect(await verifyPendingRecoveryToken(`${token}x`)).toBeNull();
  });

  it("만료된 토큰은 null", async () => {
    const expired = await new SignJWT({ typ: "recovery", user_id: "user_1", return_to: "/me" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(0)
      .setExpirationTime(1)
      .sign(getUserSessionSecret());

    expect(await verifyPendingRecoveryToken(expired)).toBeNull();
  });

  it("세션 토큰을 복구 토큰으로 재사용할 수 없다", async () => {
    // 두 토큰은 같은 시크릿과 같은 user_id 클레임을 쓴다. typ 검사가 없으면
    // 서로 바꿔치기할 수 있어서 복구 확인 화면을 건너뛰게 된다.
    const sessionToken = await createUserSessionToken({ userId: "user_1" });

    expect(await verifyPendingRecoveryToken(sessionToken)).toBeNull();
  });

  it("쿠키 설정은 15분 HttpOnly lax", () => {
    expect(PENDING_RECOVERY_COOKIE_NAME).toBe("granite_pending_recovery");
    expect(getPendingRecoveryCookieOptions()).toEqual({
      httpOnly: true,
      maxAge: 60 * 15,
      path: "/",
      sameSite: "lax",
      secure: false
    });
  });
});
