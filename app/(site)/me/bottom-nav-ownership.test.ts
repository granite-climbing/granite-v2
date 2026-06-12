import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("my page bottom nav ownership", () => {
  it("lets the site layout own the fixed bottom nav", () => {
    const files = [
      "app/(site)/me/page.tsx",
      "app/(site)/me/me-page-content.tsx",
      "app/(site)/me/projects/page.tsx",
      "app/(site)/me/records/page.tsx"
    ];

    for (const file of files) {
      expect(readSource(file)).not.toContain("<BottomNav");
      expect(readSource(file)).not.toContain("@/components/layout/bottom-nav");
    }
  });
});
