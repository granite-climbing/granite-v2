import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(site)/me/projects/page.tsx", "utf8");

describe("projects page source", () => {
  it("uses user session auth and redirects anonymous users", () => {
    expect(source).toContain("USER_SESSION_COOKIE_NAME");
    expect(source).toContain("verifyUserSessionToken");
    expect(source).toContain('redirect("/login?returnTo=/me/projects")');
  });

  it("loads saved routes and renders the project routes view", () => {
    expect(source).toContain("listSavedRoutesForUser");
    expect(source).toContain("ProjectRoutesView");
    expect(source).toContain("removeRouteProjectAction");
  });
});
