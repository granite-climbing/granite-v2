// NOT "use server" — this is a pure async helper imported by the Server Action.
// sharp is a native Node module; it is NOT safe to import in Edge runtime.

import sharp from "sharp";

const MAX_OUTPUT_DIMENSION = 4000; // px cap per side after optimization
const ALLOWED_INPUT_FORMATS = new Set(["jpeg", "png", "webp"]);

export type SanitizedImage = {
  bytes: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  // Dimensions of the stored, sanitized output.
  width: number;
  height: number;
};

/**
 * Decode the input buffer with sharp (content-sniff, not header-trust),
 * optimize large images to the configured dimension cap, then re-encode
 * without metadata.
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

  if (meta.format === "jpeg") {
    const bytes = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    const outputMeta = await sharp(bytes).metadata();
    return {
      bytes,
      contentType: "image/jpeg",
      extension: "jpg",
      width: outputMeta.width ?? meta.width,
      height: outputMeta.height ?? meta.height,
    };
  }
  if (meta.format === "png") {
    const bytes = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    const outputMeta = await sharp(bytes).metadata();
    return {
      bytes,
      contentType: "image/png",
      extension: "png",
      width: outputMeta.width ?? meta.width,
      height: outputMeta.height ?? meta.height,
    };
  }
  // webp
  const bytes = await pipeline.webp({ quality: 85 }).toBuffer();
  const outputMeta = await sharp(bytes).metadata();
  return {
    bytes,
    contentType: "image/webp",
    extension: "webp",
    width: outputMeta.width ?? meta.width,
    height: outputMeta.height ?? meta.height,
  };
}
