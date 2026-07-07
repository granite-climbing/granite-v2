import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUserSessionToken, USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  getApprovedClaimCandidateRecordsByInstagramId,
  getApprovedRecordsByUserId
} from "@/lib/db/record-queries";
import RecordsPage from "./page";

const source = readFileSync("app/(site)/me/records/page.tsx", "utf8");

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const findActiveUserByIdMock = vi.hoisted(() => vi.fn());
const getApprovedRecordsByUserIdMock = vi.hoisted(() => vi.fn());
const getApprovedClaimCandidateRecordsByInstagramIdMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/db/user-auth-queries", () => ({
  findActiveUserById: findActiveUserByIdMock
}));

vi.mock("@/lib/db/record-queries", async () => {
  const actual = await vi.importActual<typeof import("@/lib/db/record-queries")>("@/lib/db/record-queries");
  return {
    ...actual,
    getApprovedRecordsByUserId: getApprovedRecordsByUserIdMock,
    getApprovedClaimCandidateRecordsByInstagramId: getApprovedClaimCandidateRecordsByInstagramIdMock
  };
});

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

describe("RecordsPage", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "records-page-test-secret";
    cookiesMock.mockReset();
    redirectMock.mockClear();
    findActiveUserByIdMock.mockReset();
    getApprovedRecordsByUserIdMock.mockReset();
    getApprovedRecordsByUserIdMock.mockResolvedValue([]);
    getApprovedClaimCandidateRecordsByInstagramIdMock.mockReset();
    getApprovedClaimCandidateRecordsByInstagramIdMock.mockResolvedValue([]);
  });

  function stubSessionCookie(token: string | undefined) {
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === USER_SESSION_COOKIE_NAME && token !== undefined ? { value: token } : undefined
    });
  }

  it("redirects visitors without a session cookie to login with a records return target", async () => {
    stubSessionCookie(undefined);

    await expect(RecordsPage()).rejects.toThrow("NEXT_REDIRECT:/login?returnTo=/me/records");

    expect(findActiveUserByIdMock).not.toHaveBeenCalled();
    expect(getApprovedRecordsByUserId).not.toHaveBeenCalled();
    expect(getApprovedClaimCandidateRecordsByInstagramId).not.toHaveBeenCalled();
  });

  it("redirects visitors with an invalid session token to login without loading records", async () => {
    stubSessionCookie("not-a-valid-jwt");

    await expect(RecordsPage()).rejects.toThrow("NEXT_REDIRECT:/login?returnTo=/me/records");

    expect(findActiveUserByIdMock).not.toHaveBeenCalled();
    expect(getApprovedRecordsByUserId).not.toHaveBeenCalled();
    expect(getApprovedClaimCandidateRecordsByInstagramId).not.toHaveBeenCalled();
  });

  it("redirects stale sessions whose user no longer exists without loading records", async () => {
    stubSessionCookie(await createUserSessionToken({ userId: "deleted_user" }));
    findActiveUserByIdMock.mockResolvedValue(null);

    await expect(RecordsPage()).rejects.toThrow("NEXT_REDIRECT:/login?returnTo=/me/records");

    expect(findActiveUserByIdMock).toHaveBeenCalledWith("deleted_user");
    expect(getApprovedRecordsByUserId).not.toHaveBeenCalled();
    expect(getApprovedClaimCandidateRecordsByInstagramId).not.toHaveBeenCalled();
  });

  it("loads records and claim candidates with a normalized handle for users with an Instagram ID", async () => {
    stubSessionCookie(await createUserSessionToken({ userId: "user_records" }));
    findActiveUserByIdMock.mockResolvedValue({
      id: "user_records",
      instagramId: "@Climber.One"
    });

    await RecordsPage();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(getApprovedRecordsByUserId).toHaveBeenCalledWith("user_records");
    expect(getApprovedClaimCandidateRecordsByInstagramId).toHaveBeenCalledWith("climber.one");
  });

  it("passes a null handle for users without an Instagram ID", async () => {
    stubSessionCookie(await createUserSessionToken({ userId: "user_no_instagram" }));
    findActiveUserByIdMock.mockResolvedValue({
      id: "user_no_instagram",
      instagramId: null
    });

    await RecordsPage();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(getApprovedRecordsByUserId).toHaveBeenCalledWith("user_no_instagram");
    expect(getApprovedClaimCandidateRecordsByInstagramId).toHaveBeenCalledWith(null);
  });
});
