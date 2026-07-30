import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateProfileAction } from "./profile";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }));
const verifySessionMock = vi.hoisted(() => vi.fn());
const findUserMock = vi.hoisted(() => vi.fn());
const updateUserMock = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth/session", () => ({ USER_SESSION_COOKIE_NAME: "granite_user_session", verifyUserSessionToken: verifySessionMock }));
vi.mock("@/lib/db/user-auth-queries", () => ({ findActiveUserById: findUserMock, updateUserProfile: updateUserMock }));

describe("updateProfileAction", () => {
  beforeEach(() => {
    cookiesMock.mockResolvedValue({ get: () => ({ value: "session" }) });
    verifySessionMock.mockResolvedValue({ userId: "user_1" });
    findUserMock.mockResolvedValue({ id: "user_1" });
    updateUserMock.mockReset();
  });

  it("updates the signed-in user's profile and returns to my page", async () => {
    const form = new FormData();
    Object.entries({ nickname: "@granite", instagramId: "@granite", gender: "female", heightCm: "165", apeIndexCm: "168", weightKg: "55", topBoulderingGrade: "V5", topSportGrade: "5.12a", youtubeUrl: "https://youtube.com/@granite" }).forEach(([key, value]) => form.set(key, value));
    await expect(updateProfileAction(form)).rejects.toThrow("NEXT_REDIRECT:/me");
    expect(updateUserMock).toHaveBeenCalledWith("user_1", expect.objectContaining({ instagramId: "granite", youtubeUrl: "https://youtube.com/@granite" }));
  });
});
