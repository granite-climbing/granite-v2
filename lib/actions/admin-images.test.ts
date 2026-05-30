import { describe, expect, it } from "vitest";
import { validateAdminImageFileForTest } from "./admin-images-validate";

describe("admin image uploads", () => {
  it("accepts jpeg, png, and webp under 10MB", () => {
    const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });
    expect(validateAdminImageFileForTest(file)).toEqual({ extension: "jpg" });
  });

  it("rejects unsupported mime types", () => {
    const file = new File(["x"], "cover.gif", { type: "image/gif" });
    expect(() => validateAdminImageFileForTest(file)).toThrow("Unsupported image type");
  });

  it("rejects files over 10MB", () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "cover.jpg", { type: "image/jpeg" });
    expect(() => validateAdminImageFileForTest(file)).toThrow("Image is too large");
  });
});
