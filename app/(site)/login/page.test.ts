// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoginPage from "./page";

const source = () => readFileSync(join(process.cwd(), "app/(site)/login/page.tsx"), "utf8");

describe("LoginPage", () => {
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
});
