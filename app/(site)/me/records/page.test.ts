import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("app/(site)/me/records/page.tsx", "utf8");

describe("records page source", () => {
  it("uses user session auth and redirects anonymous users", () => {
    expect(source).toContain("USER_SESSION_COOKIE_NAME");
    expect(source).toContain("verifyUserSessionToken");
    expect(source).toContain('redirect("/login?returnTo=/me/records")');
  });

  it("loads the records model and renders dashboard components", () => {
    expect(source).toContain("getApprovedRecordsByUserId");
    expect(source).toContain("getApprovedClaimCandidateRecordsByInstagramId");
    expect(source).toContain("buildUserRecordsModel");
    expect(source).toContain("RecordSummary");
    expect(source).toContain("RecordGradeDistribution");
    expect(source).toContain("RecordList");
    expect(source).toContain("RecordClaimCandidates");
  });
});
