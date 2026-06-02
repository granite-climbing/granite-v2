import { describe, expect, it } from "vitest";
import {
  detectMediaPlatform,
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
