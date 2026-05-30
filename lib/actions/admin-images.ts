"use server";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { requireAdmin } from "@/lib/auth/admin";
import { insertAdminAuditLog } from "@/lib/db/admin-queries";
import { buildCdnImageUrl, buildR2ImageKey, type ImageEntityType } from "@/lib/r2/images";
import { validateAdminImageFileForTest } from "@/lib/actions/admin-images-validate";

// Re-export for tests — Next.js only requires async functions to be exported
// from "use server" modules when they are invoked as Server Actions. A re-export
// of an imported sync function is not itself a Server Action, but Next.js 15's
// bundler still flags it. The pure validator lives in admin-images-validate.ts
// so tests import it from there; this file only exports async Server Actions.

// Env names must match the committed `.env.example`: the R2 S3 endpoint is
// derived from CLOUDFLARE_ACCOUNT_ID, and the bucket is R2_BUCKET_NAME.
function getR2Client(): S3Client {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID is required for R2 upload");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

export async function uploadAdminImageAction(formData: FormData): Promise<{ cdnUrl: string }> {
  const admin = await requireAdmin();
  const file = formData.get("file");
  const entityType = formData.get("entityType");
  const entityId = formData.get("entityId");
  const purpose = formData.get("purpose");

  if (!(file instanceof File)) throw new Error("Image file is required");
  if (typeof entityType !== "string") throw new Error("entityType is required");
  if (typeof entityId !== "string") throw new Error("entityId is required");
  if (typeof purpose !== "string") throw new Error("purpose is required");

  const { extension } = validateAdminImageFileForTest(file);
  const key = buildR2ImageKey({
    entityType: entityType as ImageEntityType,
    entityId,
    purpose,
    extension,
  });

  const bytes = Buffer.from(await file.arrayBuffer());
  await getR2Client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: bytes,
    ContentType: file.type,
  }));

  const cdnUrl = buildCdnImageUrl(key);

  // Non-fatal audit log — log on failure, don't throw
  try {
    await insertAdminAuditLog({
      adminId: admin.adminId,
      action: "image.upload",
      targetType: entityType,
      targetId: entityId,
      metadata: { key, purpose, contentType: file.type, size: file.size },
    });
  } catch (err) {
    console.error("Failed to write audit log for image.upload:", err);
  }

  return { cdnUrl };
}
