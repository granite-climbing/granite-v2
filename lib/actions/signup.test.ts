import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPendingSignupToken, PENDING_SIGNUP_COOKIE_NAME } from "@/lib/auth/signup";
import { USER_SESSION_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth/session";
import { createUserForCompletedSignup } from "@/lib/db/user-auth-queries";
import { completeSignupAction } from "./signup";

const cookiesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);
const createUserForCompletedSignupMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: cookiesMock
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("@/lib/db/user-auth-queries", () => ({
  createUserForCompletedSignup: createUserForCompletedSignupMock
}));

describe("completeSignupAction", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "signup-action-test-secret";
    cookiesMock.mockReset();
    redirectMock.mockClear();
    createUserForCompletedSignupMock.mockReset();
  });

  it("creates the user from a pending OAuth signup and starts a Granite session", async () => {
    const pendingToken = await createPendingSignupToken({
      provider: "kakao",
      providerUserId: "kakao-user",
      email: "kakao@example.com",
      displayName: "Kakao Profile",
      avatarUrl: "https://img.example/kakao.jpg",
      returnTo: "/r/route_1"
    });
    const cookieSetMock = vi.fn();
    const cookieDeleteMock = vi.fn();
    cookiesMock.mockResolvedValue({
      get: (name: string) => (name === PENDING_SIGNUP_COOKIE_NAME ? { value: pendingToken } : undefined),
      set: cookieSetMock,
      delete: cookieDeleteMock
    });
    createUserForCompletedSignupMock.mockResolvedValue({
      id: "user_signup",
      displayName: "granite_climber"
    });
    const formData = new FormData();
    formData.set("nickname", "@granite_climber");
    formData.set("gender", "female");
    formData.set("heightCm", "165");
    formData.set("apeIndexCm", "168");
    formData.set("topBoulderingGrade", "V5");
    formData.set("topSportGrade", "5.12a");

    await expect(completeSignupAction(formData)).rejects.toThrow("NEXT_REDIRECT:/r/route_1");

    expect(createUserForCompletedSignup).toHaveBeenCalledWith({
      provider: "kakao",
      providerUserId: "kakao-user",
      email: "kakao@example.com",
      displayName: "granite_climber",
      avatarUrl: "https://img.example/kakao.jpg",
      instagramId: "granite_climber",
      gender: "female",
      heightCm: 165,
      apeIndexCm: 168,
      weightKg: null,
      topBoulderingGrade: "V5",
      topSportGrade: "5.12a"
    });
    const sessionCookie = cookieSetMock.mock.calls.find(([name]) => name === USER_SESSION_COOKIE_NAME);
    expect(sessionCookie?.[1]).toEqual(expect.any(String));
    await expect(verifyUserSessionToken(sessionCookie?.[1] ?? "")).resolves.toEqual({
      userId: "user_signup"
    });
    expect(cookieDeleteMock).toHaveBeenCalledWith(PENDING_SIGNUP_COOKIE_NAME);
  });
});
