import { afterEach, describe, expect, it } from "vitest";
import { decodeJwt } from "jose";
import { createUserSessionToken, USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "./session";

const originalJwtSecret = process.env.JWT_SECRET;

describe("user session tokens", () => {
  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it("uses the Phase 6 user session cookie name", () => {
    expect(USER_SESSION_COOKIE_NAME).toBe("granite_session");
  });

  it("round-trips only the user id through a signed JWT", async () => {
    process.env.JWT_SECRET = "test-user-session-secret";

    const token = await createUserSessionToken({
      userId: "user_google"
    });
    const payload = decodeJwt(token);

    const session = await verifyUserSessionToken(token);

    expect(payload.user_id).toBe("user_google");
    expect(payload.sub).toBeUndefined();
    expect(payload.email).toBeUndefined();
    expect(payload.displayName).toBeUndefined();
    expect(payload.avatarUrl).toBeUndefined();
    expect(session).toEqual({
      userId: "user_google"
    });
  });
});
