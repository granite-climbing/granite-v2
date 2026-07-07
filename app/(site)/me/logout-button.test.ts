import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "app/(site)/me/logout-button.tsx"), "utf8");

describe("LogoutButton", () => {
  it("renders as a server form instead of a client bundle", () => {
    const text = source();

    expect(text).not.toContain('"use client"');
    expect(text).not.toContain("useState");
    expect(text).toContain("<form action={logoutAction}");
  });
});
