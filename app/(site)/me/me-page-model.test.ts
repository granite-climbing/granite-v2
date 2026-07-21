import { describe, expect, it } from "vitest";
import type { User, UserOAuthIdentity } from "@/lib/db/schema";
import { buildMePageModel } from "./me-page-model";

const baseUser: User = {
  id: "user_1",
  displayName: "granite_climber",
  email: null,
  avatarUrl: null,
  instagramId: "granite.climber",
  youtubeId: null,
  gender: "female",
  heightCm: 170,
  apeIndexCm: 172,
  weightKg: null,
  topBoulderingGrade: "V5",
  topSportGrade: null,
  privacyVisibility: null,
  onboardingCompletedAt: "2026-06-04 00:00:00",
  deletedAt: null,
  createdAt: "2026-06-04 00:00:00",
  updatedAt: "2026-06-04 00:00:00"
};

const googleIdentity: UserOAuthIdentity = {
  id: "oauth_1",
  userId: "user_1",
  provider: "google",
  providerUid: "google-user",
  emailAtLink: null,
  createdAt: "2026-06-04 00:00:00",
  updatedAt: "2026-06-04 00:00:00"
};

describe("buildMePageModel", () => {
  it("builds the profile from real user and identity data without fake account details", () => {
    const model = buildMePageModel(baseUser, [googleIdentity]);

    expect(model.profileRows).toEqual([
      { label: "닉네임", value: "granite_climber", actionLabel: "수정" },
      { label: "이메일", value: "제공되지 않음" },
      { label: "로그인 방법", value: "Google" },
      { label: "비밀번호 관리", value: "소셜 로그인" }
    ]);
    expect(model.accountConnections).toEqual([
      { label: "Instagram", status: "연결안됨", linked: false },
      { label: "Youtube", status: "연결안됨", linked: false }
    ]);
    // 공개여부 토글은 이제 상호작용 가능 (disabled=false), 저장값이 없으면 전부 비공개.
    expect(model.privacyRows.every((row) => row.disabled === false)).toBe(true);
    expect(model.privacyRows.every((row) => row.enabled === false)).toBe(true);
    expect(model.privacyRows.map((row) => row.key)).toEqual([
      "instagram",
      "youtube",
      "height",
      "apeIndex",
      "weight",
      "records",
      "projects"
    ]);
  });

  it("reflects stored privacy visibility per toggle", () => {
    const model = buildMePageModel(
      { ...baseUser, privacyVisibility: JSON.stringify({ height: true, records: true }) },
      [googleIdentity]
    );

    const enabledKeys = model.privacyRows.filter((row) => row.enabled).map((row) => row.key);
    expect(enabledKeys).toEqual(["height", "records"]);
  });

  it("uses no-provider copy when the user has no linked OAuth identity", () => {
    const model = buildMePageModel({ ...baseUser, email: "climber@example.com" }, []);

    expect(model.profileRows).toContainEqual({ label: "로그인 방법", value: "확인 필요" });
    expect(model.profileRows).toContainEqual({ label: "이메일", value: "climber@example.com" });
  });
});
