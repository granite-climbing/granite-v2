import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BottomNav, getBottomNavActiveItem, shouldShowBottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  it("marks the current my tab as active", () => {
    const html = renderToStaticMarkup(<BottomNav activeItem="me" />);

    expect(html).toContain('aria-current="page"');
    expect(html).toContain("마이");
  });

  it("uses filled icons for active tabs and line icons for inactive tabs", () => {
    const html = renderToStaticMarkup(<BottomNav activeItem="me" />);

    expect(html).toContain('src="/images/figma/icons/icon_my.svg"');
    expect(html).not.toContain('src="/images/figma/icons/icon_my_line.svg"');
    expect(html).toContain('src="/images/figma/icons/icon_home_line.svg"');
    expect(html).toContain('src="/images/figma/icons/icon_project_line.svg"');
    expect(html).toContain('src="/images/figma/icons/icon_record_line.svg"');
  });

  it("maps site paths to the active bottom tab", () => {
    expect(getBottomNavActiveItem("/")).toBe("home");
    expect(getBottomNavActiveItem("/c/anyang")).toBe("home");
    expect(getBottomNavActiveItem("/me/projects")).toBe("projects");
    expect(getBottomNavActiveItem("/me/records")).toBe("records");
    expect(getBottomNavActiveItem("/me")).toBe("me");
  });

  it("keeps auth screens free of the bottom nav", () => {
    expect(shouldShowBottomNav("/login")).toBe(false);
    expect(shouldShowBottomNav("/signup")).toBe(false);
    expect(shouldShowBottomNav("/")).toBe(true);
  });
});
