import { describe, expect, it } from "vitest";
import type { User } from "@/lib/db/schema";
import { getUserRecordsView } from "./user-records-view";

const user: User = {
  id: "user_1",
  displayName: "granite_climber",
  email: null,
  avatarUrl: "https://cdn.granite.kr/users/user_1/avatar.jpg",
  instagramId: "@Granite.Rocks",
  youtubeId: null,
  gender: "male",
  heightCm: 182,
  apeIndexCm: 178,
  weightKg: 68,
  topBoulderingGrade: "V5",
  topSportGrade: null,
  onboardingCompletedAt: "2026-07-01T00:00:00.000Z",
  deletedAt: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z"
};

describe("getUserRecordsView", () => {
  it("maps profile fields from user settings with a normalized Instagram handle", async () => {
    const view = await getUserRecordsView(user);

    expect(view.profile).toEqual({
      displayName: "granite_climber",
      instagramId: "granite.rocks",
      avatarUrl: "https://cdn.granite.kr/users/user_1/avatar.jpg",
      armSpanCm: 178,
      heightCm: 182,
      weightKg: 68
    });
  });

  it("keeps missing settings null", async () => {
    const view = await getUserRecordsView({
      ...user,
      instagramId: null,
      heightCm: null,
      apeIndexCm: null,
      weightKg: null
    });

    expect(view.profile.instagramId).toBeNull();
    expect(view.profile.armSpanCm).toBeNull();
    expect(view.profile.heightCm).toBeNull();
    expect(view.profile.weightKg).toBeNull();
  });

  it("still serves mock record data until Phase 10 wiring", async () => {
    const view = await getUserRecordsView(user);

    expect(view.totalSends).toBeGreaterThan(0);
    expect(view.gradeBuckets.length).toBeGreaterThan(0);
    expect(view.recentRecords.length).toBeGreaterThan(0);
    expect(view.videos.length).toBeGreaterThan(0);
  });
});
