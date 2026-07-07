import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "components/layout/site-bottom-nav.tsx"), "utf8");

describe("SiteBottomNav", () => {
  it("derives the active item from the current pathname and reserves bottom space", () => {
    const text = source();

    expect(text).toContain('"use client"');
    expect(text).toContain("usePathname");
    expect(text).toContain("shouldShowBottomNav(pathname)");
    expect(text).toContain("getBottomNavActiveItem(pathname)");
    expect(text).toContain('className="h-[74px]"');
  });
});
