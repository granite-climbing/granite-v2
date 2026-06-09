import { describe, expect, it } from "vitest";
import {
  detectMediaPlatform,
  extractCanonicalMediaId,
  extractHashtags,
  normalizeHandle,
  normalizeToken,
  normalizeYouTubeOrInstagramUrl,
} from "./normalize";

describe("beta normalization", () => {
  it("normalizes hashtag tokens for route matching", () => {
    expect(normalizeToken(" Sky Hook ")).toBe("skyhook");
    expect(normalizeToken("#큰 바위")).toBe("큰바위");
    expect(normalizeToken("V5!")).toBe("v5");
  });

  it("extracts normalized hashtags from captions", () => {
    expect(extractHashtags("@granite.kr #큰바위 #SkyHook #모락산")).toEqual([
      "큰바위",
      "skyhook",
      "모락산",
    ]);
  });

  it("normalizes instagram handles without claiming ownership", () => {
    expect(normalizeHandle("@Granite.KR ")).toBe("granite.kr");
    expect(normalizeHandle("")).toBe("");
  });

  it("accepts instagram and youtube URLs only", () => {
    expect(detectMediaPlatform("https://www.instagram.com/reel/abc/")).toBe("instagram");
    expect(detectMediaPlatform("https://youtu.be/abc")).toBe("youtube");
    expect(() => detectMediaPlatform("https://example.com/video")).toThrow("Unsupported media URL");
  });

  it("returns canonical URL strings", () => {
    expect(normalizeYouTubeOrInstagramUrl("https://www.youtube.com/watch?v=abc&feature=share")).toBe(
      "https://www.youtube.com/watch?v=abc&feature=share"
    );
  });
});

describe("extractCanonicalMediaId", () => {
  it("extracts YouTube video id from every supported URL format", () => {
    expect(extractCanonicalMediaId("https://youtu.be/dQw4w9WgXcQ", "youtube")).toBe("dQw4w9WgXcQ");
    expect(extractCanonicalMediaId("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube")).toBe("dQw4w9WgXcQ");
    expect(
      extractCanonicalMediaId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share", "youtube")
    ).toBe("dQw4w9WgXcQ");
    expect(extractCanonicalMediaId("https://www.youtube.com/shorts/dQw4w9WgXcQ", "youtube")).toBe("dQw4w9WgXcQ");
    expect(extractCanonicalMediaId("https://www.youtube.com/embed/dQw4w9WgXcQ", "youtube")).toBe("dQw4w9WgXcQ");
  });

  it("extracts Instagram shortcode from /p/, /reel/, /tv/ regardless of query string", () => {
    expect(extractCanonicalMediaId("https://www.instagram.com/p/CxYz123abc/", "instagram")).toBe("CxYz123abc");
    expect(extractCanonicalMediaId("https://www.instagram.com/reel/CxYz123abc/", "instagram")).toBe("CxYz123abc");
    expect(extractCanonicalMediaId("https://www.instagram.com/tv/CxYz123abc/", "instagram")).toBe("CxYz123abc");
    expect(
      extractCanonicalMediaId("https://www.instagram.com/p/CxYz123abc/?utm_source=ig_web", "instagram")
    ).toBe("CxYz123abc");
  });

  it("returns null when the URL pattern doesn't match a known media format", () => {
    expect(extractCanonicalMediaId("https://www.youtube.com/", "youtube")).toBeNull();
    expect(extractCanonicalMediaId("https://www.youtube.com/channel/UCabcd", "youtube")).toBeNull();
    expect(extractCanonicalMediaId("https://www.instagram.com/some_user/", "instagram")).toBeNull();
    expect(extractCanonicalMediaId("not-a-url", "youtube")).toBeNull();
  });
});
