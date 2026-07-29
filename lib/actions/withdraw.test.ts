import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { withdrawAccountAction } from "./withdraw";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const verifyUserSessionTokenMock = vi.hoisted(() => vi.fn());
const findActiveUserByIdMock = vi.hoisted(() => vi.fn());
const markUserWithdrawnMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session");
  return { ...actual, verifyUserSessionToken: verifyUserSessionTokenMock };
});
vi.mock("@/lib/db/user-auth-queries", () => ({
  findActiveUserById: findActiveUserByIdMock,
  markUserWithdrawn: markUserWithdrawnMock
}));

function mockCookieStore(token: string | undefined) {
  const set = vi.fn();
  cookiesMock.mockResolvedValue({
    get: vi.fn(() => (token === undefined ? undefined : { value: token })),
    set
  });
  return set;
}

describe("withdrawAccountAction", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
    verifyUserSessionTokenMock.mockReset();
    findActiveUserByIdMock.mockReset();
    markUserWithdrawnMock.mockReset();
  });

  it("탈퇴를 기록하고 세션을 지운 뒤 안내와 함께 로그인으로 보낸다", async () => {
    const set = mockCookieStore("session-token");
    verifyUserSessionTokenMock.mockResolvedValue({ userId: "user_1" });
    findActiveUserByIdMock.mockResolvedValue({ id: "user_1" });
    markUserWithdrawnMock.mockResolvedValue(true);

    await expect(withdrawAccountAction()).rejects.toThrow("NEXT_REDIRECT:/login?withdrawn=1");

    expect(markUserWithdrawnMock).toHaveBeenCalledWith("user_1");
    expect(set).toHaveBeenCalledWith(
      USER_SESSION_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0, path: "/" })
    );
  });

  it("세션이 없으면 아무것도 바꾸지 않고 로그인으로 보낸다", async () => {
    mockCookieStore(undefined);

    await expect(withdrawAccountAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(markUserWithdrawnMock).not.toHaveBeenCalled();
  });

  it("이미 탈퇴한 계정이면 조용히 로그아웃만 한다", async () => {
    const set = mockCookieStore("session-token");
    verifyUserSessionTokenMock.mockResolvedValue({ userId: "user_1" });
    findActiveUserByIdMock.mockResolvedValue(null);

    await expect(withdrawAccountAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(markUserWithdrawnMock).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(USER_SESSION_COOKIE_NAME, "", expect.objectContaining({ maxAge: 0 }));
  });
});
