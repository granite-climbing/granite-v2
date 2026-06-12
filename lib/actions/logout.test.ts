import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { logoutAction } from "./logout";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

describe("logoutAction", () => {
  beforeEach(() => {
    cookiesMock.mockReset();
    redirectMock.mockClear();
  });

  it("clears the user session cookie and redirects to /login", async () => {
    const cookieSetMock = vi.fn();
    cookiesMock.mockResolvedValue({
      set: cookieSetMock
    });

    await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT:/login");

    expect(cookieSetMock).toHaveBeenCalledWith(
      USER_SESSION_COOKIE_NAME,
      "",
      expect.objectContaining({
        maxAge: 0,
        path: "/"
      })
    );
  });
});
