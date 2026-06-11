import { describe, expect, it } from "vitest";
import { normalizeOAuthProfile } from "./profile";

describe("OAuth profile normalization", () => {
  it("normalizes Kakao account payloads", () => {
    const profile = normalizeOAuthProfile("kakao", {
      id: 12345,
      kakao_account: {
        email: "climber@example.com",
        profile: {
          nickname: "Granite Climber",
          profile_image_url: "https://img.example/avatar.jpg"
        }
      }
    });

    expect(profile).toEqual({
      provider: "kakao",
      providerUserId: "12345",
      email: "climber@example.com",
      displayName: "Granite Climber",
      avatarUrl: "https://img.example/avatar.jpg"
    });
  });

  it("normalizes Naver response payloads", () => {
    const profile = normalizeOAuthProfile("naver", {
      response: {
        id: "naver-user",
        email: "naver@example.com",
        nickname: "Naver Climber",
        profile_image: "https://img.example/naver.jpg"
      }
    });

    expect(profile).toEqual({
      provider: "naver",
      providerUserId: "naver-user",
      email: "naver@example.com",
      displayName: "Naver Climber",
      avatarUrl: "https://img.example/naver.jpg"
    });
  });

  it("normalizes Google OpenID userinfo payloads", () => {
    const profile = normalizeOAuthProfile("google", {
      sub: "google-user",
      email: "google@example.com",
      name: "Google Climber",
      picture: "https://img.example/google.jpg"
    });

    expect(profile.providerUserId).toBe("google-user");
    expect(profile.displayName).toBe("Google Climber");
  });
});
