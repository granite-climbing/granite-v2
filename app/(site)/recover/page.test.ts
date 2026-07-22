import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RecoverPage from "./page";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const verifyPendingRecoveryTokenMock = vi.hoisted(() => vi.fn());
const findWithdrawnUserByIdMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/recovery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/recovery")>("@/lib/auth/recovery");
  return { ...actual, verifyPendingRecoveryToken: verifyPendingRecoveryTokenMock };
});
vi.mock("@/lib/db/user-auth-queries", () => ({
  findWithdrawnUserById: findWithdrawnUserByIdMock
}));
vi.mock("@/lib/actions/recover", () => ({
  restoreAccountAction: vi.fn(),
  cancelRecoveryAction: vi.fn()
}));

function mockCookieStore(token: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: vi.fn(() => (token === undefined ? undefined : { value: token }))
  });
}

describe("RecoverPage", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
    verifyPendingRecoveryTokenMock.mockReset();
    findWithdrawnUserByIdMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
  });

  it("복구 쿠키가 없으면 로그인으로 보낸다", async () => {
    mockCookieStore(undefined);

    await expect(RecoverPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("복구 대상이 없으면 recovery_unavailable 로 보낸다", async () => {
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue(null);

    await expect(RecoverPage()).rejects.toThrow("NEXT_REDIRECT:/login?error=recovery_unavailable");
  });

  it("보관 기간이 지났으면 recovery_expired 로 보낸다", async () => {
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue({
      id: "user_1",
      displayName: "granite",
      withdrawAt: "2026-01-01T00:00:00.000Z"
    });

    await expect(RecoverPage()).rejects.toThrow("NEXT_REDIRECT:/login?error=recovery_expired");
  });

  it("복구 가능하면 안내와 삭제 예정일을 보여준다", async () => {
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue({
      id: "user_1",
      displayName: "granite",
      withdrawAt: "2026-07-01T00:00:00.000Z"
    });

    const html = renderToStaticMarkup(await RecoverPage());

    expect(html).toContain("탈퇴 신청된 계정입니다");
    expect(html).toContain("granite");
    expect(html).toContain("복구하기");
    expect(html).toContain("2027");
  });
});
