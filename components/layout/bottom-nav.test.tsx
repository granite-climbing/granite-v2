import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BottomNav } from "./bottom-nav";

describe("BottomNav", () => {
  it("marks the current my tab as active", () => {
    const html = renderToStaticMarkup(<BottomNav activeItem="me" />);

    expect(html).toContain('aria-current="page"');
    expect(html).toContain("마이");
  });
});
