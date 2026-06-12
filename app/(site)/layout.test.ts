import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "app/(site)/layout.tsx"), "utf8");

describe("SiteLayout", () => {
  it("loads the Kakao AdFit script for site pages", () => {
    const text = source();

    expect(text).toContain("next/script");
    expect(text).toContain("//t1.daumcdn.net/kas/static/ba.min.js");
    expect(text).toContain('strategy="afterInteractive"');
  });
});
