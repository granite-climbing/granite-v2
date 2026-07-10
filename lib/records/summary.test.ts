import { describe, expect, it } from "vitest";
import {
  buildRouteRecordSummary,
  formatConsensusLabel,
  formatFeltGrade,
  formatTimeAgo,
  type RouteRecordRow,
} from "./summary";

function row(overrides: Partial<RouteRecordRow> = {}): RouteRecordRow {
  return {
    id: `rec_${Math.random().toString(36).slice(2)}`,
    displayName: "클라이머",
    avatarUrl: null,
    sentAt: "2026-07-01",
    createdAt: "2026-07-01 10:00:00",
    rating: null,
    feltGradeNum: null,
    comment: null,
    ...overrides,
  };
}

describe("formatFeltGrade", () => {
  it("formats regular grades and caps at V12+", () => {
    expect(formatFeltGrade(0)).toBe("V0");
    expect(formatFeltGrade(4)).toBe("V4");
    expect(formatFeltGrade(12)).toBe("V12+");
    expect(formatFeltGrade(15)).toBe("V12+");
  });
});

describe("formatConsensusLabel", () => {
  it("labels near-integer averages Solid", () => {
    expect(formatConsensusLabel(4.0)).toBe("Solid V4");
    expect(formatConsensusLabel(4.2)).toBe("Solid V4");
    expect(formatConsensusLabel(3.8)).toBe("Solid V4");
  });

  it("labels rounded-up averages Soft and rounded-down Hard", () => {
    expect(formatConsensusLabel(4.7)).toBe("Soft V5");
    expect(formatConsensusLabel(4.3)).toBe("Hard V4");
  });
});

describe("formatTimeAgo", () => {
  const now = new Date("2026-07-10T12:00:00");

  it("renders today, days, months, years", () => {
    expect(formatTimeAgo("2026-07-10", now)).toBe("today");
    expect(formatTimeAgo("2026-07-09", now)).toBe("1 day ago");
    expect(formatTimeAgo("2026-07-01", now)).toBe("9 days ago");
    expect(formatTimeAgo("2025-12-10", now)).toBe("6 months ago");
    expect(formatTimeAgo("2024-06-01", now)).toBe("2 years ago");
  });
});

describe("buildRouteRecordSummary", () => {
  it("returns an all-empty summary for no records", () => {
    const summary = buildRouteRecordSummary([]);
    expect(summary.ascents).toBe(0);
    expect(summary.ratingCount).toBe(0);
    expect(summary.averageRating).toBeNull();
    expect(summary.stars).toBe(0);
    expect(summary.feelsGradeNum).toBeNull();
    expect(summary.consensusLabel).toBeNull();
    expect(summary.feltDistribution).toEqual([]);
    expect(summary.comments).toEqual([]);
  });

  it("averages ratings/felt grades and rounds to 1 decimal", () => {
    const summary = buildRouteRecordSummary([
      row({ rating: 5, feltGradeNum: 4 }),
      row({ rating: 4, feltGradeNum: 4 }),
      row({ rating: null, feltGradeNum: 5 }),
    ]);
    expect(summary.ascents).toBe(3);
    expect(summary.ratingCount).toBe(2);
    expect(summary.averageRating).toBe(4.5);
    expect(summary.stars).toBe(5);
    expect(summary.feelsGradeNum).toBe(4.3);
    expect(summary.consensusLabel).toBe("Hard V4");
  });

  it("builds the felt distribution ordered by grade with ratio vs max", () => {
    const summary = buildRouteRecordSummary([
      row({ feltGradeNum: 5 }),
      row({ feltGradeNum: 4 }),
      row({ feltGradeNum: 4 }),
      row({ feltGradeNum: 3 }),
    ]);
    expect(summary.feltDistribution).toEqual([
      { grade: "V3", count: 1, ratio: 0.5 },
      { grade: "V4", count: 2, ratio: 1 },
      { grade: "V5", count: 1, ratio: 0.5 },
    ]);
  });

  it("collects only rows with a comment, keeping felt grade and rating", () => {
    const summary = buildRouteRecordSummary([
      row({ comment: "완등이 어려웠어요", feltGradeNum: 11, rating: 4, displayName: "닉네임" }),
      row({ comment: null, rating: 5 }),
    ]);
    expect(summary.comments).toHaveLength(1);
    expect(summary.comments[0]).toMatchObject({
      body: "완등이 어려웠어요",
      feltGrade: "V11",
      rating: 4,
      displayName: "닉네임",
    });
  });

  it("counts records without ratings in ascents only", () => {
    const summary = buildRouteRecordSummary([row(), row()]);
    expect(summary.ascents).toBe(2);
    expect(summary.ratingCount).toBe(0);
    expect(summary.averageRating).toBeNull();
  });
});
