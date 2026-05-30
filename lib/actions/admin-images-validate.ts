// Pure, IO-free validation helpers for admin image uploads.
// Kept in a separate module so they can be imported by tests without triggering
// the "use server" constraint that requires all exports to be async.

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function validateAdminImageFileForTest(file: File): { extension: string } {
  const extension = allowedTypes.get(file.type);
  if (!extension) throw new Error("Unsupported image type");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image is too large");
  return { extension };
}

export { MAX_IMAGE_BYTES };
