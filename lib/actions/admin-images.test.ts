import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { validateAdminImageFileForTest } from "./admin-images-validate";
import { sanitizeAdminImage } from "./admin-images-sanitize";

// ---------------------------------------------------------------------------
// Existing pure-validator tests (kept unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// sanitizeAdminImage tests
// ---------------------------------------------------------------------------

describe("sanitizeAdminImage", () => {
  // Test A — happy-path jpeg
  it("returns expected shape for a plain jpeg", async () => {
    const input = await sharp({
      create: { width: 100, height: 80, channels: 3, background: "#fff" },
    })
      .jpeg()
      .toBuffer();

    const sanitized = await sanitizeAdminImage(input);

    expect(sanitized.contentType).toBe("image/jpeg");
    expect(sanitized.extension).toBe("jpg");
    expect(sanitized.width).toBe(100);
    expect(sanitized.height).toBe(80);
    expect(sanitized.bytes.length).toBeGreaterThan(0);
  });

  // Test B — rejects non-image data
  it("rejects non-image data", async () => {
    const input = Buffer.from("definitely not an image");
    await expect(sanitizeAdminImage(input)).rejects.toThrow(/Invalid image data|Unsupported/);
  });

  // Test C — rejects images that exceed MAX_DIMENSION (4000px)
  it("rejects images that exceed MAX_DIMENSION", async () => {
    const input = await sharp({
      create: { width: 5000, height: 10, channels: 3, background: "#fff" },
    })
      .jpeg()
      .toBuffer();

    await expect(sanitizeAdminImage(input)).rejects.toThrow(/dimensions/);
  });

  // Test D — EXIF/GPS metadata is stripped from the output
  it("strips EXIF/GPS metadata from the output", async () => {
    // Build a jpeg with embedded EXIF metadata (Make field in IFD0).
    // sharp's Exif type only exposes IFD0-IFD3 namespaces; GPS tags live in
    // a GPS sub-IFD which sharp does not model separately in its TS types.
    // Embedding Make in IFD0 is sufficient to confirm EXIF is present and then
    // verify it is absent in the sanitized output.
    const inputWithExif = await sharp({
      create: { width: 50, height: 50, channels: 3, background: "#fff" },
    })
      .jpeg()
      .withExif({
        IFD0: { Make: "TestCam", ImageDescription: "GPS:37.5,127.0" },
      })
      .toBuffer();

    // Confirm EXIF is present in the input
    const metaBefore = await sharp(inputWithExif).metadata();
    expect(metaBefore.exif).toBeDefined();

    // Sanitize
    const sanitized = await sanitizeAdminImage(inputWithExif);

    // Confirm EXIF is gone from the output
    const metaAfter = await sharp(sanitized.bytes).metadata();
    expect(metaAfter.exif).toBeUndefined();
  });

  // Test E — webp input produces webp output
  it("returns webp contentType and extension for webp input", async () => {
    const input = await sharp({
      create: { width: 60, height: 40, channels: 3, background: "#aabbcc" },
    })
      .webp()
      .toBuffer();

    const sanitized = await sanitizeAdminImage(input);

    expect(sanitized.contentType).toBe("image/webp");
    expect(sanitized.extension).toBe("webp");
    expect(sanitized.width).toBe(60);
    expect(sanitized.height).toBe(40);
    expect(sanitized.bytes.length).toBeGreaterThan(0);
  });
});
