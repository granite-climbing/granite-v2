import { beforeEach, describe, expect, it, vi } from "vitest";
import { PENDING_RECOVERY_COOKIE_NAME } from "@/lib/auth/recovery";
import { USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { cancelRecoveryAction, restoreAccountAction } from "./recover";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const verifyPendingRecoveryTokenMock = vi.hoisted(() => vi.fn());
const findWithdrawnUserByIdMock = vi.hoisted(() => vi.fn());
const restoreWithdrawnUserMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/recovery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/recovery")>("@/lib/auth/recovery");
  return { ...actual, verifyPendingRecoveryToken: verifyPendingRecoveryTokenMock };
});
vi.mock("@/lib/db/user-auth-queries", () => ({
  findWithdrawnUserById: findWithdrawnUserByIdMock,
  restoreWithdrawnUser: restoreWithdrawnUserMock
}));

function mockCookieStore(token: string | undefined) {
  const set = vi.fn();
  cookiesMock.mockResolvedValue({
    get: vi.fn(() => (token === undefined ? undefined : { value: token })),
    set
  });
  return set;
}

describe("restoreAccountAction", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
    verifyPendingRecoveryTokenMock.mockReset();
    findWithdrawnUserByIdMock.mockReset();
    restoreWithdrawnUserMock.mockReset();
    vi.useRealTimers();
  });

  it("복구 후 세션을 발급하고 returnTo 로 보낸다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
    const set = mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me/records" });
    findWithdrawnUserByIdMock.mockResolvedValue({
      id: "user_1",
      withdrawAt: "2026-07-01T00:00:00.000Z"
    });
    restoreWithdrawnUserMock.mockResolvedValue(true);

    await expect(restoreAccountAction()).rejects.toThrow("NEXT_REDIRECT:/me/records");

    expect(restoreWithdrawnUserMock).toHaveBeenCalledWith("user_1");
    expect(set).toHaveBeenCalledWith(
      USER_SESSION_COOKIE_NAME,
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
    expect(set).toHaveBeenCalledWith(
      PENDING_RECOVERY_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0 })
    );
  });

  it("쿠키가 없으면 로그인으로 보낸다", async () => {
    mockCookieStore(undefined);

    await expect(restoreAccountAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(restoreWithdrawnUserMock).not.toHaveBeenCalled();
  });

  it("보관 기간이 지났으면 recovery_expired 로 안내한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue({
      id: "user_1",
      withdrawAt: "2026-01-01T00:00:00.000Z"
    });

    await expect(restoreAccountAction()).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=recovery_expired"
    );

    expect(restoreWithdrawnUserMock).not.toHaveBeenCalled();
  });

  it("경합으로 UPDATE 가 0건이면 recovery_expired 로 안내한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue({
      id: "user_1",
      withdrawAt: "2026-07-01T00:00:00.000Z"
    });
    restoreWithdrawnUserMock.mockResolvedValue(false);

    await expect(restoreAccountAction()).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=recovery_expired"
    );
  });

  it("복구 대상이 없으면 recovery_unavailable 로 안내한다", async () => {
    mockCookieStore("recovery-token");
    verifyPendingRecoveryTokenMock.mockResolvedValue({ userId: "user_1", returnTo: "/me" });
    findWithdrawnUserByIdMock.mockResolvedValue(null);

    await expect(restoreAccountAction()).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=recovery_unavailable"
    );
  });
});

describe("cancelRecoveryAction", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
  });

  it("복구 쿠키만 지우고 로그인으로 보낸다", async () => {
    const set = mockCookieStore("recovery-token");

    await expect(cancelRecoveryAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(set).toHaveBeenCalledWith(
      PENDING_RECOVERY_COOKIE_NAME,
      "",
      expect.objectContaining({ maxAge: 0 })
    );
  });
});
