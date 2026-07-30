import { describe, expect, it } from "vitest";
import { parseProfileInput } from "./profile-input";

function profileFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const values = {
    nickname: "@granite_climber",
    gender: "female",
    heightCm: "165",
    apeIndexCm: "168",
    weightKg: "55",
    topBoulderingGrade: "V5",
    topSportGrade: "5.12a",
    youtubeUrl: "",
    ...overrides
  };

  Object.entries(values).forEach(([key, value]) => formData.set(key, value));
  return formData;
}

describe("parseProfileInput", () => {
  it("normalizes the Instagram handle and preserves an optional YouTube channel URL", () => {
    expect(
      parseProfileInput(
        profileFormData({ youtubeUrl: "https://youtube.com/@granite" })
      )
    ).toEqual({
      instagramId: "granite_climber",
      gender: "female",
      heightCm: 165,
      apeIndexCm: 168,
      weightKg: 55,
      topBoulderingGrade: "V5",
      topSportGrade: "5.12a",
      youtubeUrl: "https://youtube.com/@granite"
    });
  });

  it("allows an empty YouTube channel URL", () => {
    expect(parseProfileInput(profileFormData())?.youtubeUrl).toBeNull();
  });

  it("rejects a non-YouTube channel URL", () => {
    expect(
      parseProfileInput(profileFormData({ youtubeUrl: "https://example.com/granite" }))
    ).toBeNull();
  });
});
