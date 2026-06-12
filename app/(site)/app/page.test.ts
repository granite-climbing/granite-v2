import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUserSessionToken, USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { findActiveUserById } from "@/lib/db/user-auth-queries";
import AppEntryPage from "./page";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const findActiveUserByIdMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/db/user-auth-queries", () => ({
  findActiveUserById: findActiveUserByIdMock
}));

describe("AppEntryPage", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "app-entry-test-secret";
    cookiesMock.mockReset();
    redirectMock.mockClear();
    findActiveUserByIdMock.mockReset();
  });

  it("redirects app visitors without a web session to the web login page", async () => {
    cookiesMock.mockResolvedValue({
      get: () => undefined
    });

    await expect(AppEntryPage()).rejects.toThrow("NEXT_REDIRECT:/login?returnTo=/me");

    expect(findActiveUserById).not.toHaveBeenCalled();
  });

  it("redirects app visitors with a valid web session to my page", async () => {
    const sessionToken = await createUserSessionToken({
      userId: "user_app"
    });
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === USER_SESSION_COOKIE_NAME ? { value: sessionToken } : undefined)
    });
    findActiveUserByIdMock.mockResolvedValue({
      id: "user_app"
    });

    await expect(AppEntryPage()).rejects.toThrow("NEXT_REDIRECT:/me");

    expect(findActiveUserById).toHaveBeenCalledWith("user_app");
  });

  it("redirects stale app visitors back to login", async () => {
    const sessionToken = await createUserSessionToken({
      userId: "deleted_user"
    });
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === USER_SESSION_COOKIE_NAME ? { value: sessionToken } : undefined)
    });
    findActiveUserByIdMock.mockResolvedValue(null);

    await expect(AppEntryPage()).rejects.toThrow("NEXT_REDIRECT:/login?returnTo=/me");
  });
});
