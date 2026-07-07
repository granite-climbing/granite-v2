import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildUserRecordsModel,
  getApprovedClaimCandidateRecordsByInstagramId,
  getApprovedRecordsByUserId,
  getRecordGradeBuckets
} from "./record-queries";

const queryD1Mock = vi.hoisted(() => vi.fn());

vi.mock("./d1-http", () => ({
  queryD1: queryD1Mock
}));

describe("record queries", () => {
  beforeEach(() => {
    queryD1Mock.mockReset();
  });

  it("loads approved owned records for a user", async () => {
    queryD1Mock.mockResolvedValueOnce([
      {
        betaId: "beta_1",
        routeId: "route_1",
        topoId: "topo_1",
        routeName: "Little Finger",
        routeGrade: "V5",
        routeGradeNum: 5,
        boulderName: "리틀핑거 바위",
        sectorName: "메인 섹터",
        cragName: "현충바위",
        platform: "instagram",
        mediaUrl: "https://www.instagram.com/reel/example/",
        thumbnailUrl: "https://cdn.granite.kr/betas/beta_1/thumb.jpg",
        sentAt: "2026-07-01T00:00:00.000Z",
        displayName: "granite_user"
      }
    ]);

    const records = await getApprovedRecordsByUserId("user_1");

    expect(queryD1Mock).toHaveBeenCalledWith(expect.stringContaining("be.user_id = ?"), ["user_1"]);
    expect(queryD1Mock.mock.calls[0][0]).toContain("be.status = 'approved'");
    expect(queryD1Mock.mock.calls[0][0]).toContain("be.deleted_at IS NULL");
    expect(records).toEqual([
      expect.objectContaining({
        betaId: "beta_1",
        routeName: "Little Finger",
        routeGrade: "V5"
      })
    ]);
  });

  it("loads approved unclaimed Instagram claim candidates", async () => {
    queryD1Mock.mockResolvedValueOnce([
      {
        betaId: "beta_2",
        routeId: "route_2",
        topoId: "topo_2",
        routeName: "Even Flow",
        routeGrade: "V7",
        routeGradeNum: 7,
        boulderName: "이븐플로우 바위",
        sectorName: "메인 섹터",
        cragName: "인수봉",
        platform: "instagram",
        mediaUrl: "https://www.instagram.com/reel/candidate/",
        thumbnailUrl: null,
        sentAt: "2026-07-02T00:00:00.000Z",
        displayName: "granite_user",
        instagramId: "granite_user",
        claimStatus: "unclaimed"
      }
    ]);

    const candidates = await getApprovedClaimCandidateRecordsByInstagramId("granite_user");

    expect(queryD1Mock).toHaveBeenCalledWith(expect.stringContaining("be.user_id IS NULL"), ["granite_user"]);
    expect(queryD1Mock.mock.calls[0][0]).toContain("be.claim_status = 'unclaimed'");
    expect(queryD1Mock.mock.calls[0][0]).toContain("be.platform = 'instagram'");
    expect(candidates[0]).toMatchObject({
      betaId: "beta_2",
      claimStatus: "unclaimed",
      instagramId: "granite_user"
    });
  });

  it("returns no claim candidates when Instagram id is missing", async () => {
    const candidates = await getApprovedClaimCandidateRecordsByInstagramId(null);

    expect(candidates).toEqual([]);
    expect(queryD1Mock).not.toHaveBeenCalled();
  });

  it("builds grade buckets from records", () => {
    const buckets = getRecordGradeBuckets([
      { routeGrade: "V5", routeGradeNum: 5 },
      { routeGrade: "V7", routeGradeNum: 7 },
      { routeGrade: "V5", routeGradeNum: 5 }
    ]);

    expect(buckets).toEqual([
      { grade: "V5", gradeNum: 5, count: 2 },
      { grade: "V7", gradeNum: 7, count: 1 }
    ]);
  });

  it("builds a records model summary", () => {
    const model = buildUserRecordsModel({
      records: [
        {
          betaId: "beta_1",
          routeId: "route_1",
          topoId: "topo_1",
          routeName: "Little Finger",
          routeGrade: "V5",
          routeGradeNum: 5,
          boulderName: "리틀핑거 바위",
          sectorName: "메인 섹터",
          cragName: "현충바위",
          platform: "instagram",
          mediaUrl: "https://www.instagram.com/reel/example/",
          thumbnailUrl: null,
          sentAt: "2026-07-01T00:00:00.000Z",
          displayName: "granite_user"
        }
      ],
      claimCandidates: [
        {
          betaId: "beta_2",
          routeId: "route_2",
          topoId: "topo_2",
          routeName: "Even Flow",
          routeGrade: "V7",
          routeGradeNum: 7,
          boulderName: "이븐플로우 바위",
          sectorName: "메인 섹터",
          cragName: "인수봉",
          platform: "instagram",
          mediaUrl: "https://www.instagram.com/reel/candidate/",
          thumbnailUrl: null,
          sentAt: "2026-07-02T00:00:00.000Z",
          displayName: "granite_user",
          instagramId: "granite_user",
          claimStatus: "unclaimed"
        }
      ]
    });

    expect(model.summary).toEqual({
      totalRecords: 1,
      highestGrade: "V5",
      latestSentAt: "2026-07-01T00:00:00.000Z",
      claimCandidateCount: 1
    });
    expect(model.gradeBuckets).toEqual([{ grade: "V5", gradeNum: 5, count: 1 }]);
  });
});
