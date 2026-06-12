import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(join(process.cwd(), "app/(site)/login/page.tsx"), "utf8");

describe("LoginPage", () => {
  it("uses the Figma provider icon assets in login buttons", () => {
    const text = source();

    expect(text).toContain("/images/figma/icons/icon_${provider}.svg");
    expect(text).toContain('alt=""');
    expect(text).toContain('aria-hidden="true"');
  });
});
