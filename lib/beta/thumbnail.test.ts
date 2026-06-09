import { describe, expect, it } from "vitest";
import {
  extractInstagramHtmlAuthorName,
  extractInstagramHtmlThumbnailUrl,
  extractYouTubeThumbnailUrl,
  inferImageExtensionFromContentType,
} from "./thumbnail";

describe("thumbnail helpers", () => {
  it("extracts youtu.be thumbnail URL", () => {
    expect(extractYouTubeThumbnailUrl("https://youtu.be/abc123")).toBe("https://img.youtube.com/vi/abc123/hqdefault.jpg");
  });

  it("extracts youtube watch thumbnail URL", () => {
    expect(extractYouTubeThumbnailUrl("https://www.youtube.com/watch?v=abc123")).toBe(
      "https://img.youtube.com/vi/abc123/hqdefault.jpg"
    );
  });

  it("returns null for instagram because oEmbed fetch is required", () => {
    expect(extractYouTubeThumbnailUrl("https://www.instagram.com/p/abc/")).toBeNull();
  });

  it("extracts instagram HTML og:image fallback", () => {
    const html = '<html><head><meta property="og:image" content="https://instagram-cdn.example/thumb.jpg"></head></html>';
    expect(extractInstagramHtmlThumbnailUrl(html)).toBe("https://instagram-cdn.example/thumb.jpg");
  });

  it("extracts instagram HTML twitter:image fallback", () => {
    const html = '<meta name="twitter:image" content="https://instagram-cdn.example/twitter.jpg">';
    expect(extractInstagramHtmlThumbnailUrl(html)).toBe("https://instagram-cdn.example/twitter.jpg");
  });

  it("extracts instagram author username from HTML metadata", () => {
    const html = '<meta property="og:title" content="granite_beta on Instagram: &quot;완등&quot;">';
    expect(extractInstagramHtmlAuthorName(html)).toBe("granite_beta");
  });

  it("infers safe image extensions", () => {
    expect(inferImageExtensionFromContentType("image/jpeg")).toBe("jpg");
    expect(inferImageExtensionFromContentType("image/png")).toBe("png");
    expect(inferImageExtensionFromContentType("text/html")).toBeNull();
  });
});
