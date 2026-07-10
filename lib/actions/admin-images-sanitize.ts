// NOT "use server" — this is a pure async helper imported by the Server Action.
// sharp is a native Node module; it is NOT safe to import in Edge runtime.

import sharp from "sharp";

const MAX_OUTPUT_DIMENSION = 1600; // px cap per side after optimization
const ALLOWED_INPUT_FORMATS = new Set(["jpeg", "png", "webp"]);

export type SanitizedImage = {
  bytes: Buffer;
  contentType: "image/webp";
  extension: "webp";
  // Dimensions of the stored, sanitized output.
  width: number;
  height: number;
};

/**
 * Decode the input buffer with sharp (content-sniff, not header-trust),
 * optimize large images to the configured dimension cap, then re-encode
 * as WebP without metadata.
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

  // Fresh pipeline — no .withMetadata() means no EXIF/XMP/GPS in output.
  // .rotate() reads the EXIF Orientation tag, applies the transform, then
  // discards all metadata as part of the re-encode.
  const pipeline = sharp(input)
    .rotate()
    .resize({
      width: MAX_OUTPUT_DIMENSION,
      height: MAX_OUTPUT_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

  const bytes = await pipeline.webp({ quality: 82, effort: 4 }).toBuffer();
  const outputMeta = await sharp(bytes).metadata();
  return {
    bytes,
    contentType: "image/webp",
    extension: "webp",
    width: outputMeta.width ?? meta.width,
    height: outputMeta.height ?? meta.height,
  };
}
