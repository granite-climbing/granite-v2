import { describe, expect, it } from "vitest";
import { buildCdnImageUrl, buildR2ImageKey } from "./images";

describe("image helpers", () => {
  it("builds entity-scoped R2 keys without an images table", () => {
    expect(
      buildR2ImageKey({
        entityType: "boulders",
        entityId: "boulder-big",
        purpose: "cover image",
        extension: ".JPG",
        uuid: "fixed"
      })
    ).toBe("boulders/boulder-big/cover-image-fixed.jpg");
  });

  it("builds Cloudflare CDN URLs with optional resizing params", () => {
    expect(buildCdnImageUrl("boulders/boulder-big/cover-fixed.jpg", { width: 720, quality: 80 })).toBe(
      "https://cdn.granite.kr/boulders/boulder-big/cover-fixed.jpg?w=720&q=80"
    );
  });
});
