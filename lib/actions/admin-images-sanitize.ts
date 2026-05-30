// NOT "use server" — this is a pure async helper imported by the Server Action.
// sharp is a native Node module; it is NOT safe to import in Edge runtime.

import sharp from "sharp";

const MAX_DIMENSION = 4000; // px hard cap per side
const ALLOWED_INPUT_FORMATS = new Set(["jpeg", "png", "webp"]);

export type SanitizedImage = {
  bytes: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  // Dimensions are PRE-rotation (from EXIF metadata read).
  // This is intentional: they are used only for audit logging, where the
  // original declared dimensions are more useful than post-rotation values.
  width: number;
  height: number;
};

/**
 * Decode the input buffer with sharp (content-sniff, not header-trust),
 * enforce format and dimension limits, then re-encode without metadata.
 *
 * sharp drops all EXIF/XMP/ICC/GPS metadata unless `.withMetadata()` is
 * explicitly called — so the re-encode pipeline is the stripping mechanism.
 * `.rotate()` applies any EXIF orientation flag before stripping so the
 * visual output is correctly oriented.
 */
export async function sanitizeAdminImage(input: Buffer): Promise<SanitizedImage> {
  // sharp throws on non-image input — that is the content-sniffing layer.
  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new Error("Invalid image data");
  }

  if (!meta.format || !ALLOWED_INPUT_FORMATS.has(meta.format)) {
    throw new Error("Unsupported image format");
  }
  if (!meta.width || !meta.height) {
    throw new Error("Image dimensions are missing");
  }
  if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
    throw new Error(`Image dimensions exceed ${MAX_DIMENSION}px`);
  }

  // Fresh pipeline — no .withMetadata() means no EXIF/XMP/GPS in output.
  // .rotate() reads the EXIF Orientation tag, applies the transform, then
  // discards all metadata as part of the re-encode.
  const pipeline = sharp(input).rotate();

  if (meta.format === "jpeg") {
    const bytes = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    return { bytes, contentType: "image/jpeg", extension: "jpg", width: meta.width, height: meta.height };
  }
  if (meta.format === "png") {
    const bytes = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    return { bytes, contentType: "image/png", extension: "png", width: meta.width, height: meta.height };
  }
  // webp
  const bytes = await pipeline.webp({ quality: 85 }).toBuffer();
  return { bytes, contentType: "image/webp", extension: "webp", width: meta.width, height: meta.height };
}
