import { describe, expect, it } from "vitest";
import { assertAllowedExternalFetchUrl, isAllowedImageContentType } from "./fetch-guard";

describe("external fetch guard", () => {
  it("allows expected instagram and youtube hosts", () => {
    expect(() => assertAllowedExternalFetchUrl("https://www.instagram.com/p/abc/", "page")).not.toThrow();
    expect(() => assertAllowedExternalFetchUrl("https://img.youtube.com/vi/abc/hqdefault.jpg", "image")).not.toThrow();
    expect(() => assertAllowedExternalFetchUrl("https://scontent-icn1-1.cdninstagram.com/v/t51/thumb.jpg", "image")).not.toThrow();
  });

  it("rejects private and unsupported hosts", () => {
    expect(() => assertAllowedExternalFetchUrl("http://127.0.0.1/admin", "page")).toThrow("Unsupported external fetch protocol");
    expect(() => assertAllowedExternalFetchUrl("https://example.com/image.jpg", "image")).toThrow("Unsupported external fetch host");
  });

  it("allows only image content types for thumbnail storage", () => {
    expect(isAllowedImageContentType("image/jpeg")).toBe(true);
    expect(isAllowedImageContentType("text/html")).toBe(false);
  });
});
