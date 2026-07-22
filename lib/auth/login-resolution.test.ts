import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/db/schema";
import type { OAuthProfile } from "./oauth/types";
import { resolveOAuthLogin } from "./login-resolution";

const findLoginCandidateMock = vi.hoisted(() => vi.fn());
const purgeExpiredMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/user-auth-queries", () => ({
  findLoginCandidateByOAuthIdentity: findLoginCandidateMock,
  purgeExpiredWithdrawnUser: purgeExpiredMock
}));

const profile: OAuthProfile = {
  provider: "google",
  providerUserId: "google-user",
  email: "climber@example.com",
  displayName: "granite",
  avatarUrl: null
};

function makeUser(withdrawAt: string | null): User {
  return {
    id: "user_1",
    displayName: "granite",
    email: "climber@example.com",
    avatarUrl: null,
    instagramId: null,
    youtubeId: null,
    gender: null,
    heightCm: null,
    apeIndexCm: null,
    weightKg: null,
    topBoulderingGrade: null,
    topSportGrade: null,
    privacyVisibility: null,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    withdrawAt,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

const NOW = new Date("2026-07-22T00:00:00.000Z");

describe("resolveOAuthLogin", () => {
  beforeEach(() => {
    findLoginCandidateMock.mockReset();
    purgeExpiredMock.mockReset();
  });

  it("계정이 없으면 signup", async () => {
    findLoginCandidateMock.mockResolvedValueOnce(null);

    await expect(resolveOAuthLogin(profile, NOW)).resolves.toEqual({ kind: "signup" });
    expect(findLoginCandidateMock).toHaveBeenCalledWith("google", "google-user");
    expect(purgeExpiredMock).not.toHaveBeenCalled();
  });

  it("정상 계정이면 session", async () => {
    const user = makeUser(null);
    findLoginCandidateMock.mockResolvedValueOnce(user);

    await expect(resolveOAuthLogin(profile, NOW)).resolves.toEqual({ kind: "session", user });
    expect(purgeExpiredMock).not.toHaveBeenCalled();
  });

  it("6개월 이내 탈퇴 계정이면 recover", async () => {
    const user = makeUser("2026-07-01T00:00:00.000Z");
    findLoginCandidateMock.mockResolvedValueOnce(user);

    await expect(resolveOAuthLogin(profile, NOW)).resolves.toEqual({ kind: "recover", user });
    expect(purgeExpiredMock).not.toHaveBeenCalled();
  });

  it("6개월이 지난 탈퇴 계정은 정리하고 signup 으로 보낸다", async () => {
    findLoginCandidateMock.mockResolvedValueOnce(makeUser("2026-01-01T00:00:00.000Z"));

    await expect(resolveOAuthLogin(profile, NOW)).resolves.toEqual({ kind: "signup" });
    expect(purgeExpiredMock).toHaveBeenCalledWith("user_1");
  });
});
