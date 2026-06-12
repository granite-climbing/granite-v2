import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "app/(site)/me/page.tsx"), "utf8");

describe("MePage", () => {
  it("uses the shared sticky my page header for the logged-out state", () => {
    const text = source();

    expect(text).toContain("MyPageHeader");
    expect(text).toContain("<MyPageHeader />");
  });
});
