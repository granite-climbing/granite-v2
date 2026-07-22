// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoginPage from "./page";

const source = () => readFileSync(join(process.cwd(), "app/(site)/login/page.tsx"), "utf8");

describe("LoginPage", () => {
  it("does not show the unavailable email sign-in option", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByRole("button", { name: "이메일로 시작하기" })).toBeNull();
  });

  it("offers a close control that safely leaves the login screen", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("link", { name: "로그인 닫기" }).getAttribute("href")).toBe("/");
  });

  it("uses the Figma provider icon assets in login buttons", () => {
    const text = source();

    expect(text).toContain("/images/figma/icons/icon_${provider}.svg");
    expect(text).toContain('alt=""');
    expect(text).toContain('aria-hidden="true"');
  });

  it("does not render legal links on the login screen", () => {
    const text = source();

    expect(text).toContain("data-hide-site-footer");
    expect(text).not.toContain("/terms");
    expect(text).not.toContain("/privacy");
    expect(text).not.toContain("이용약관");
    expect(text).not.toContain("개인정보처리방침");
  });

  it("keeps provider button backgrounds opaque when a provider is unavailable", () => {
    const text = source();

    expect(text).not.toContain("opacity-45");
  });

  it("shows a recovery notice when redirected after withdrawal", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ withdrawn: "1" }) }));

    expect(
      screen.getByText("탈퇴가 완료되었습니다. 6개월 안에 다시 로그인하면 계정을 복구할 수 있습니다.")
    ).toBeInTheDocument();
  });

  it("shows a recovery-expired message instead of the generic failure message", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ error: "recovery_expired" }) }));

    expect(screen.getByText("복구 가능 기간이 지났습니다. 새로 가입해 주세요.")).toBeInTheDocument();
    expect(screen.queryByText(/로그인에 실패했습니다/)).toBeNull();
  });
});
