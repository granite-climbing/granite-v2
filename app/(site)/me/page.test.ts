import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { findActiveUserById, findOAuthIdentitiesByUserId } from "@/lib/db/user-auth-queries";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const findActiveUserByIdMock = vi.hoisted(() => vi.fn());
const findOAuthIdentitiesByUserIdMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/db/user-auth-queries", () => ({
  findActiveUserById: findActiveUserByIdMock,
  findOAuthIdentitiesByUserId: findOAuthIdentitiesByUserIdMock
}));

describe("MePage", () => {
  beforeEach(() => {
    vi.stubGlobal("React", React);
    cookiesMock.mockReset();
    redirectMock.mockClear();
    findActiveUserByIdMock.mockReset();
    findOAuthIdentitiesByUserIdMock.mockReset();
  });

  it("redirects visitors without a session to login with a my-page return target", async () => {
    const { default: MePage } = await import("./page");
    cookiesMock.mockResolvedValue({
      get: () => undefined
    });

    await expect(MePage()).rejects.toThrow("NEXT_REDIRECT:/login?returnTo=/me");

    expect(findActiveUserById).not.toHaveBeenCalled();
    expect(findOAuthIdentitiesByUserId).not.toHaveBeenCalled();
  });
});
