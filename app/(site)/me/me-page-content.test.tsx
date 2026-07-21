import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MePageModel } from "./me-page-model";
import { MyPageContent } from "./me-page-content";

const model: MePageModel = {
  displayName: "granite_climber",
  avatarUrl: null,
  profileRows: [
    { label: "닉네임", value: "granite_climber", actionLabel: "수정" },
    { label: "이메일", value: "제공되지 않음" },
    { label: "로그인 방법", value: "Google" },
    { label: "비밀번호 관리", value: "소셜 로그인" }
  ],
  privacyRows: [
    { label: "Instagram 계정", enabled: false, disabled: true },
    { label: "Youtube 계정", enabled: false, disabled: true },
    { label: "키", enabled: false, disabled: true },
    { label: "암 스팬", enabled: false, disabled: true },
    { label: "몸무게", enabled: false, disabled: true },
    { label: "기록", enabled: false, disabled: true },
    { label: "프로젝트", enabled: false, disabled: true }
  ],
  accountConnections: [
    { label: "Instagram", status: "연결됨", linked: true },
    { label: "Youtube", status: "연결안됨", linked: false }
  ]
};

describe("MyPageContent", () => {
  it("renders the my page shell without invented email or password values", () => {
    const html = renderToStaticMarkup(
      <MyPageContent model={model} logoutSlot={<button type="button">로그아웃</button>} />
    );

    expect(html).toContain("마이");
    expect(html).toContain("granite_climber");
    expect(html).toContain("제공되지 않음");
    expect(html).toContain("소셜 로그인");
    expect(html).toContain("공개여부");
    expect(html).toContain("계정 연결");
    expect(html).toContain(">계정</h2>");
    expect(html).toContain("로그아웃");
    expect(html).toContain("회원탈퇴");
    expect(html).toContain("data-hide-site-footer");
    expect(html).toContain("sticky top-0");
    expect(html).toContain("h-[56px]");
    expect(html).not.toContain("h-[96px]");
    expect(html).not.toContain("granite@gmail.com");
    expect(html).not.toContain("******");
  });
});
