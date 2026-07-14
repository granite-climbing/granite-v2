import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFixedGradeBuckets,
  buildUserRecordsModel,
  getApprovedClaimCandidateRecordsByInstagramId,
  getApprovedRecordsByUserId,
  getOwnBetaVideosByUserId,
  getRecordGradeBuckets,
  getUserRecordsByUserId,
  insertUserRecord,
  searchPublishedRoutesForRecord
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

  it("builds an empty records model with fallbacks", () => {
    const model = buildUserRecordsModel({ records: [], claimCandidates: [] });

    expect(model.summary.highestGrade).toBe("-");
    expect(model.summary.latestSentAt).toBeNull();
    expect(model.summary.totalRecords).toBe(0);
    expect(model.summary.claimCandidateCount).toBe(0);
    expect(model.gradeBuckets).toEqual([]);
  });

  it("picks the highest grade even when it is not the latest record", () => {
    const baseRecord = {
      topoId: "topo_1",
      boulderName: "리틀핑거 바위",
      sectorName: "메인 섹터",
      cragName: "현충바위",
      platform: "instagram" as const,
      mediaUrl: "https://www.instagram.com/reel/example/",
      thumbnailUrl: null,
      displayName: "granite_user"
    };

    const model = buildUserRecordsModel({
      records: [
        {
          ...baseRecord,
          betaId: "beta_1",
          routeId: "route_1",
          routeName: "Latest Route",
          routeGrade: "V5",
          routeGradeNum: 5,
          sentAt: "2026-07-03T00:00:00.000Z"
        },
        {
          ...baseRecord,
          betaId: "beta_2",
          routeId: "route_2",
          routeName: "Hardest Route",
          routeGrade: "V8",
          routeGradeNum: 8,
          sentAt: "2026-07-02T00:00:00.000Z"
        },
        {
          ...baseRecord,
          betaId: "beta_3",
          routeId: "route_3",
          routeName: "Easiest Route",
          routeGrade: "V3",
          routeGradeNum: 3,
          sentAt: "2026-07-01T00:00:00.000Z"
        }
      ],
      claimCandidates: []
    });

    expect(model.summary.highestGrade).toBe("V8");
    expect(model.summary.latestSentAt).toBe("2026-07-03T00:00:00.000Z");
  });

  it("inserts a user record", async () => {
    queryD1Mock.mockResolvedValueOnce([]);

    await insertUserRecord({
      id: "rec_1",
      userId: "user_1",
      routeId: "route_1",
      betaId: null,
      sentAt: "2026-07-09",
      rating: 4,
      feltGradeNum: 5,
      comment: "완등이 어려웠어요"
    });

    const [sql, params] = queryD1Mock.mock.calls[0];
    expect(sql).toContain("INSERT INTO user_records");
    expect(sql).toContain("felt_grade_num");
    expect(sql).toContain("comment");
    expect(params).toEqual([
      "rec_1",
      "user_1",
      "route_1",
      null,
      "2026-07-09",
      4,
      5,
      "완등이 어려웠어요"
    ]);
  });

  it("loads user records with published route context", async () => {
    queryD1Mock.mockResolvedValueOnce([
      {
        recordId: "rec_1",
        routeId: "route_1",
        topoId: "topo_1",
        routeName: "Honey No.6",
        routeGrade: "V6",
        routeGradeNum: 6,
        boulderName: "허니 볼더",
        sectorName: "허니1",
        cragName: "안양예술공원",
        sentAt: "2026-07-09",
        rating: 4
      }
    ]);

    const records = await getUserRecordsByUserId("user_1");

    const [sql, params] = queryD1Mock.mock.calls[0];
    expect(sql).toContain("FROM user_records ur");
    expect(sql).toContain("ur.user_id = ?");
    expect(sql).toContain("ur.deleted_at IS NULL");
    expect(sql).toContain("r.is_published = 1");
    expect(params).toEqual(["user_1"]);
    expect(records[0]).toMatchObject({ recordId: "rec_1", routeGrade: "V6" });
  });

  it("searches published routes by escaped LIKE term", async () => {
    queryD1Mock.mockResolvedValueOnce([]);

    await searchPublishedRoutesForRecord("honey_50%");

    const [sql, params] = queryD1Mock.mock.calls[0];
    expect(sql).toContain("r.name LIKE ? ESCAPE");
    expect(params[0]).toBe("%honey\\_50\\%%");
  });

  it("returns no results for a blank search term without querying", async () => {
    const results = await searchPublishedRoutesForRecord("   ");

    expect(results).toEqual([]);
    expect(queryD1Mock).not.toHaveBeenCalled();
  });

  it("builds fixed V0-V12+ chart buckets", () => {
    const buckets = buildFixedGradeBuckets([
      { routeGradeNum: 0 },
      { routeGradeNum: 5 },
      { routeGradeNum: 5 },
      { routeGradeNum: 13 }
    ]);

    expect(buckets).toHaveLength(13);
    expect(buckets[0]).toEqual({ grade: "V0", gradeNum: 0, count: 1 });
    expect(buckets[5]).toEqual({ grade: "V5", gradeNum: 5, count: 2 });
    expect(buckets[12]).toEqual({ grade: "V12+", gradeNum: 12, count: 1 });
  });

  it("loads own beta videos including pending", async () => {
    queryD1Mock.mockResolvedValueOnce([{ id: "beta_1", thumbnailUrl: null, title: "Honey No.6" }]);

    const videos = await getOwnBetaVideosByUserId("user_1");

    const [sql, params] = queryD1Mock.mock.calls[0];
    expect(sql).toContain("be.user_id = ?");
    expect(sql).toContain("be.status IN ('pending', 'approved')");
    expect(params).toEqual(["user_1"]);
    expect(videos[0].title).toBe("Honey No.6");
  });
});
