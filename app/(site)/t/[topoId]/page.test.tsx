import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "app/(site)/t/[topoId]/page.tsx"), "utf8");

describe("Topo route detail page Phase 7 wiring", () => {
  it("uses the RouteMoreActions entrypoint instead of the old beta action", () => {
    const text = source();

    expect(text).toContain('import { RouteMoreActions } from "@/components/public/route-more-actions"');
    expect(text).not.toContain("BetaRouteActions");
    expect(text).toContain("breadcrumb=");
    expect(text).toContain(">Location<");
  });
});
