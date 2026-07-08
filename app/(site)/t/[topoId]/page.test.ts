import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(__dirname, "page.tsx"), "utf-8");

describe("TopoPage source", () => {
  it("wires the route save action into the topo route sheet", () => {
    expect(source).toContain("saveRouteProjectAction");
    expect(source).toContain("removeRouteProjectAction");
    expect(source).toContain("listFavoritedRouteIdsForUser");
    expect(source).toContain("USER_SESSION_COOKIE_NAME");
    expect(source).toContain("verifyUserSessionToken");
  });
});
