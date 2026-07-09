import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUserSessionToken, USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import RecordsPage from "./page";

const source = readFileSync("app/(site)/me/records/page.tsx", "utf8");

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const findActiveUserByIdMock = vi.hoisted(() => vi.fn());
const getUserRecordsMock = vi.hoisted(() => vi.fn(async () => []));
const getOwnVideosMock = vi.hoisted(() => vi.fn(async () => []));

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/db/user-auth-queries", () => ({
  findActiveUserById: findActiveUserByIdMock
}));

vi.mock("@/lib/db/record-queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/record-queries")>()),
  getUserRecordsByUserId: getUserRecordsMock,
  getOwnBetaVideosByUserId: getOwnVideosMock
}));

describe("records page source", () => {
  it("uses user session auth and redirects anonymous users", () => {
    expect(source).toContain("USER_SESSION_COOKIE_NAME");
    expect(source).toContain("verifyUserSessionToken");
    expect(source).toContain('redirect("/login?returnTo=/me/records")');
  });

  it("renders the records dashboard sections from the records view model", () => {
    expect(source).toContain("getUserRecordsView");
    expect(source).toContain("RecordsProfileHeader");
    expect(source).toContain("RecordsTabs");
    expect(source).toContain("RecordSendChart");
    expect(source).toContain("RecordList");
    expect(source).toContain("RecordVideoGrid");
  });
});

describe("RecordsPage", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "records-page-test-secret";
    cookiesMock.mockReset();
    redirectMock.mockClear();
    findActiveUserByIdMock.mockReset();
  });

  function stubSessionCookie(token: string | undefined) {
    cookiesMock.mockResolvedValue({
      get: (name: string) =>
        name === USER_SESSION_COOKIE_NAME && token !== undefined ? { value: token } : undefined
    });
  }

  const activeUser = {
    id: "user_records",
    displayName: "granite_climber",
    instagramId: "@Climber.One",
    avatarUrl: null,
    heightCm: 182,
    apeIndexCm: 178,
    weightKg: 68
  };

  it("redirects visitors without a session cookie to login with a records return target", async () => {
    stubSessionCookie(undefined);

    await expect(RecordsPage({})).rejects.toThrow("NEXT_REDIRECT:/login?returnTo=/me/records");

    expect(findActiveUserByIdMock).not.toHaveBeenCalled();
  });

  it("redirects visitors with an invalid session token to login", async () => {
    stubSessionCookie("not-a-valid-jwt");

    await expect(RecordsPage({})).rejects.toThrow("NEXT_REDIRECT:/login?returnTo=/me/records");

    expect(findActiveUserByIdMock).not.toHaveBeenCalled();
  });

  it("redirects stale sessions whose user no longer exists", async () => {
    stubSessionCookie(await createUserSessionToken({ userId: "deleted_user" }));
    findActiveUserByIdMock.mockResolvedValue(null);

    await expect(RecordsPage({})).rejects.toThrow("NEXT_REDIRECT:/login?returnTo=/me/records");

    expect(findActiveUserByIdMock).toHaveBeenCalledWith("deleted_user");
  });

  it("renders the records tab by default for a logged-in user", async () => {
    stubSessionCookie(await createUserSessionToken({ userId: "user_records" }));
    findActiveUserByIdMock.mockResolvedValue(activeUser);

    const page = await RecordsPage({});

    expect(redirectMock).not.toHaveBeenCalled();
    expect(JSON.stringify(page)).toContain('"active":"record"');
  });

  it("renders the videos tab when ?tab=video is set", async () => {
    stubSessionCookie(await createUserSessionToken({ userId: "user_records" }));
    findActiveUserByIdMock.mockResolvedValue(activeUser);

    const page = await RecordsPage({ searchParams: Promise.resolve({ tab: "video" }) });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(JSON.stringify(page)).toContain('"active":"video"');
  });

  it("passes the user's settings to the profile header", async () => {
    stubSessionCookie(await createUserSessionToken({ userId: "user_records" }));
    findActiveUserByIdMock.mockResolvedValue(activeUser);

    const page = await RecordsPage({});
    const rendered = JSON.stringify(page);

    expect(rendered).toContain('"displayName":"granite_climber"');
    expect(rendered).toContain('"instagramId":"climber.one"');
    expect(rendered).toContain('"armSpanCm":178');
    expect(rendered).toContain('"heightCm":182');
    expect(rendered).toContain('"weightKg":68');
  });
});
