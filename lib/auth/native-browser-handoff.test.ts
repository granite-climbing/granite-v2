import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NATIVE_BROWSER_HANDOFF_TTL_SECONDS,
  createNativeBrowserChallenge,
  createNativeBrowserHandoff,
  verifyNativeBrowserHandoff
} from "./native-browser-handoff";

describe("native browser OAuth handoff", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");
  const verifier = "native-verifier-for-a-single-ios-login-attempt";
  const challenge = createNativeBrowserChallenge(verifier);

  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "native-browser-handoff-test-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    {
      kind: "session" as const,
      userId: "user-1",
      returnTo: "/me",
      challenge
    },
    {
      kind: "signup" as const,
      provider: "kakao" as const,
      providerUserId: "kakao-1",
      email: "climber@example.com",
      displayName: "그래나이트",
      avatarUrl: "https://example.com/avatar.png",
      returnTo: "/me",
      challenge
    },
    {
      kind: "recover" as const,
      userId: "user-2",
      returnTo: "/projects",
      challenge
    }
  ])("round-trips an encrypted $kind handoff", async (payload) => {
    const token = await createNativeBrowserHandoff(payload, { now });

    expect(token.split(".")).toHaveLength(5);
    await expect(verifyNativeBrowserHandoff(token, { now })).resolves.toEqual(payload);
  });

  it("derives a stable base64url SHA-256 challenge", () => {
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createNativeBrowserChallenge(verifier)).toBe(challenge);
    expect(createNativeBrowserChallenge(`${verifier}-different`)).not.toBe(challenge);
  });

  it("rejects a tampered handoff", async () => {
    const token = await createNativeBrowserHandoff(
      { kind: "session", userId: "user-1", returnTo: "/me", challenge },
      { now }
    );
    const parts = token.split(".");
    parts[3] = `${parts[3].startsWith("a") ? "b" : "a"}${parts[3].slice(1)}`;

    await expect(verifyNativeBrowserHandoff(parts.join("."), { now })).rejects.toThrow();
  });

  it("rejects an expired handoff", async () => {
    const token = await createNativeBrowserHandoff(
      { kind: "session", userId: "user-1", returnTo: "/me", challenge },
      { now }
    );
    const expiredAt = new Date(now.getTime() + (NATIVE_BROWSER_HANDOFF_TTL_SECONDS + 1) * 1000);

    await expect(verifyNativeBrowserHandoff(token, { now: expiredAt })).rejects.toThrow();
  });

  it("rejects an unsafe return path before issuing a handoff", async () => {
    await expect(
      createNativeBrowserHandoff(
        { kind: "session", userId: "user-1", returnTo: "//attacker.example", challenge },
        { now }
      )
    ).rejects.toThrow();
  });
});
