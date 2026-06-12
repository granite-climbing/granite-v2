import { describe, expect, it, afterEach } from "vitest";
import {
  createAppWebSessionHandoffToken,
  verifyAppWebSessionHandoffToken
} from "./app-handoff";

const originalJwtSecret = process.env.JWT_SECRET;

describe("app web session handoff", () => {
  afterEach(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it("creates a short-lived handoff token for a web session", async () => {
    process.env.JWT_SECRET = "app-handoff-test-secret";

    const token = await createAppWebSessionHandoffToken({
      userId: "user_app_1",
      returnTo: "/me"
    });

    await expect(verifyAppWebSessionHandoffToken(token)).resolves.toEqual({
      userId: "user_app_1",
      returnTo: "/me"
    });
  });

  it("normalizes unsafe return paths to the account page", async () => {
    process.env.JWT_SECRET = "app-handoff-test-secret";

    const token = await createAppWebSessionHandoffToken({
      userId: "user_app_1",
      returnTo: "https://example.com/phish"
    });

    await expect(verifyAppWebSessionHandoffToken(token)).resolves.toEqual({
      userId: "user_app_1",
      returnTo: "/me"
    });
  });

  it("rejects invalid handoff tokens", async () => {
    await expect(verifyAppWebSessionHandoffToken("not-a-jwt")).resolves.toBeNull();
  });
});
