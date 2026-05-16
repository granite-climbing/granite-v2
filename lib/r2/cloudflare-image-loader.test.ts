import { describe, expect, it } from "vitest";
import cloudflareImageLoader from "./cloudflare-image-loader";

describe("cloudflareImageLoader", () => {
  it("adds Cloudflare resizing params to absolute image URLs", () => {
    const url = cloudflareImageLoader({
      src: "https://cdn.granite.kr/crags/moraksan/cover.jpg",
      width: 720,
      quality: 80
    });

    expect(url).toBe("https://cdn.granite.kr/crags/moraksan/cover.jpg?w=720&q=80");
  });

  it("builds CDN URL for relative R2 keys", () => {
    const originalCdnBaseUrl = process.env.CDN_BASE_URL;
    process.env.CDN_BASE_URL = "https://cdn.granite.kr";

    const url = cloudflareImageLoader({
      src: "boulders/abc/cover.jpg",
      width: 360
    });

    process.env.CDN_BASE_URL = originalCdnBaseUrl;
    expect(url).toBe("https://cdn.granite.kr/boulders/abc/cover.jpg?w=360&q=75");
  });
});
