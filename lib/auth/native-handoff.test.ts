import { describe, expect, it } from "vitest";
import {
  createNativeAuthHandoffToken,
  verifyNativeAuthHandoffToken
} from "./native-handoff";

describe("native auth handoff token", () => {
  it("round-trips a returning user handoff", async () => {
    process.env.JWT_SECRET = "native-handoff-test-secret";

    const token = await createNativeAuthHandoffToken({
      kind: "session",
      userId: "user_1",
      returnTo: "/me"
    });

    await expect(verifyNativeAuthHandoffToken(token)).resolves.toEqual({
      kind: "session",
      userId: "user_1",
      returnTo: "/me"
    });
  });

  it("round-trips a pending signup handoff", async () => {
    process.env.JWT_SECRET = "native-handoff-test-secret";

    const token = await createNativeAuthHandoffToken({
      kind: "signup",
      provider: "kakao",
      providerUserId: "kakao-user",
      email: null,
      displayName: "Kakao User",
      avatarUrl: null,
      returnTo: "/me"
    });

    await expect(verifyNativeAuthHandoffToken(token)).resolves.toEqual({
      kind: "signup",
      provider: "kakao",
      providerUserId: "kakao-user",
      email: null,
      displayName: "Kakao User",
      avatarUrl: null,
      returnTo: "/me"
    });
  });

  it("returns null for invalid handoff tokens", async () => {
    process.env.JWT_SECRET = "native-handoff-test-secret";

    await expect(verifyNativeAuthHandoffToken("not-a-token")).resolves.toBeNull();
  });

  it("sanitizes unsafe return targets", async () => {
    process.env.JWT_SECRET = "native-handoff-test-secret";

    const token = await createNativeAuthHandoffToken({
      kind: "session",
      userId: "user_1",
      returnTo: "https://evil.example"
    });

    await expect(verifyNativeAuthHandoffToken(token)).resolves.toMatchObject({
      returnTo: "/me"
    });
  });
});
