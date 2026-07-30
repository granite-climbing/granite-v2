import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProfileForm } from "./profile-form";

describe("ProfileForm", () => {
  it("prefills editable profile values for an existing user", () => {
    const html = renderToStaticMarkup(
      <ProfileForm
        action={async () => undefined}
        submitLabel="수정 완료"
        initialValues={{
          nickname: "granite_climber",
          gender: "female",
          heightCm: 165,
          apeIndexCm: 168,
          weightKg: 55,
          topBoulderingGrade: "V5",
          topSportGrade: "5.12a",
          youtubeUrl: "https://youtube.com/@granite"
        }}
      />
    );

    expect(html).toContain('name="nickname"');
    expect(html).toContain('value="granite_climber"');
    expect(html).toContain('name="youtubeUrl"');
    expect(html).toContain('value="https://youtube.com/@granite"');
    expect(html).toContain("YouTube 채널 URL (선택)");
    expect(html).toContain("수정 완료");
  });
});
