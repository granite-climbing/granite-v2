import { describe, expect, it } from "vitest";
import {
  createPendingSignupToken,
  getPendingSignupCookieOptions,
  PENDING_SIGNUP_COOKIE_NAME,
  verifyPendingSignupToken
} from "./signup";

describe("pending signup tokens", () => {
  it("round-trips OAuth profile data for first-time signup completion", async () => {
    process.env.JWT_SECRET = "pending-signup-test-secret";

    const token = await createPendingSignupToken({
      provider: "kakao",
      providerUserId: "kakao-123",
      email: "climber@example.com",
      displayName: "OAuth Name",
      avatarUrl: "https://example.com/avatar.jpg",
      returnTo: "/me"
    });

    await expect(verifyPendingSignupToken(token)).resolves.toEqual({
      provider: "kakao",
      providerUserId: "kakao-123",
      email: "climber@example.com",
      displayName: "OAuth Name",
      avatarUrl: "https://example.com/avatar.jpg",
      returnTo: "/me"
    });
  });

  it("uses a short-lived httpOnly cookie for pending signup", () => {
    expect(PENDING_SIGNUP_COOKIE_NAME).toBe("granite_pending_signup");
    expect(getPendingSignupCookieOptions()).toMatchObject({
      httpOnly: true,
      maxAge: 60 * 15,
      path: "/",
      sameSite: "lax"
    });
  });
});
