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
