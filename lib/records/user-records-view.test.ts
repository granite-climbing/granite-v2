import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/lib/db/schema";

const getUserRecordsMock = vi.hoisted(() => vi.fn());
const getOwnVideosMock = vi.hoisted(() => vi.fn());
const buildBucketsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/record-queries", () => ({
  getUserRecordsByUserId: getUserRecordsMock,
  getOwnBetaVideosByUserId: getOwnVideosMock,
  buildFixedGradeBuckets: buildBucketsMock
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
    getUserRecordsMock.mockResolvedValue([]);
    getOwnVideosMock.mockResolvedValue([]);
    buildBucketsMock.mockReturnValue([{ grade: "V0", gradeNum: 0, count: 0 }]);
  });

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

  it("builds the view from user records and own videos", async () => {
    getUserRecordsMock.mockResolvedValue([
      {
        recordId: "rec_2",
        routeId: "route_2",
        topoId: "topo_2",
        routeName: "Honey No.6",
        routeGrade: "V6",
        routeGradeNum: 6,
        boulderName: "허니 볼더",
        sectorName: "허니1",
        cragName: "안양예술공원",
        sentAt: "2026-07-09",
        rating: 4
      },
      {
        recordId: "rec_1",
        routeId: "route_1",
        topoId: "topo_1",
        routeName: "Even Flow",
        routeGrade: "V3",
        routeGradeNum: 3,
        boulderName: "볼더",
        sectorName: "섹터",
        cragName: "인수봉",
        sentAt: "2026-07-01",
        rating: null
      }
    ]);
    getOwnVideosMock.mockResolvedValue([{ id: "beta_1", thumbnailUrl: null, title: "Honey No.6" }]);

    const view = await getUserRecordsView(user);

    expect(getUserRecordsMock).toHaveBeenCalledWith("user_1");
    expect(getOwnVideosMock).toHaveBeenCalledWith("user_1");
    expect(view.totalSends).toBe(2);
    expect(view.highestGrade).toBe("V6");
    expect(view.recentRecords[0]).toEqual({
      id: "rec_2",
      routeName: "Honey No.6",
      grade: "V6",
      location: "안양예술공원"
    });
    expect(view.videos).toEqual([{ id: "beta_1", thumbnailUrl: null, title: "Honey No.6" }]);
  });

  it("returns empty-state values without records", async () => {
    const view = await getUserRecordsView(user);

    expect(view.totalSends).toBe(0);
    expect(view.highestGrade).toBe("-");
    expect(view.recentRecords).toEqual([]);
    expect(view.videos).toEqual([]);
  });

  it("limits recent records to three items", async () => {
    getUserRecordsMock.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({
        recordId: `rec_${index}`,
        routeId: `route_${index}`,
        topoId: `topo_${index}`,
        routeName: `Route ${index}`,
        routeGrade: "V2",
        routeGradeNum: 2,
        boulderName: "볼더",
        sectorName: "섹터",
        cragName: "크랙",
        sentAt: "2026-07-01",
        rating: null
      }))
    );

    const view = await getUserRecordsView(user);

    expect(view.recentRecords).toHaveLength(3);
  });
});
