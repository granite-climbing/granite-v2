import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdSlot } from "./ad-slot";

describe("AdSlot", () => {
  it("renders the Kakao AdFit slot copied from the previous site", () => {
    const html = renderToStaticMarkup(<AdSlot />);

    expect(html).toContain("kakao_ad_area");
    expect(html).toContain('data-ad-unit="DAN-NdbPSsrEqJVleWrJ"');
    expect(html).toContain('data-ad-width="320"');
    expect(html).toContain('data-ad-height="50"');
    expect(html).not.toContain(">광고<");
  });
});
