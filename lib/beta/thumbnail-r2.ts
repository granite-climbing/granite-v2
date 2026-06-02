import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fetchInstagramOEmbed } from "./instagram-oembed";
import { fetchInstagramHtmlThumbnail } from "./instagram-html";
import { extractYouTubeThumbnailUrl, inferImageExtensionFromContentType } from "./thumbnail";

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024; // 5 MB

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

function cdnUrlFor(key: string): string {
  const baseUrl = process.env.CDN_BASE_URL ?? "https://cdn.granite.kr";
  return new URL(`/${key}`, baseUrl).toString();
}

async function resolveThumbnailSourceUrl(input: {
  platform: "instagram" | "youtube";
  postUrl: string;
}): Promise<string | null> {
  if (input.platform === "youtube") {
    return extractYouTubeThumbnailUrl(input.postUrl);
  }
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (appId && appSecret) {
    try {
      const oembed = await fetchInstagramOEmbed({
        postUrl: input.postUrl,
        appId,
        appSecret,
      });
      if (oembed?.thumbnailUrl) return oembed.thumbnailUrl;
    } catch (err) {
      console.warn("instagram oEmbed failed:", err);
    }
  }
  try {
    return await fetchInstagramHtmlThumbnail(input.postUrl);
  } catch (err) {
    console.warn("instagram HTML fallback failed:", err);
    return null;
  }
}

export async function acquireAndStoreBetaThumbnail(input: {
  betaId: string;
  platform: "instagram" | "youtube";
  postUrl: string;
}): Promise<string | null> {
  const source = await resolveThumbnailSourceUrl({ platform: input.platform, postUrl: input.postUrl });
  if (!source) return null;

  let response: Response;
  try {
    response = await fetch(source, { signal: AbortSignal.timeout(5000) });
  } catch (err) {
    console.warn("thumbnail source fetch failed:", err);
    return null;
  }
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type");
  const extension = inferImageExtensionFromContentType(contentType);
  if (!extension) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_THUMBNAIL_BYTES) return null;

  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    console.warn("R2_BUCKET_NAME not set, skipping thumbnail upload");
    return null;
  }

  const key = `betas/${input.betaId}/thumb-${crypto.randomUUID()}.${extension}`;
  try {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType ?? `image/${extension}`,
      })
    );
  } catch (err) {
    console.warn("R2 upload failed:", err);
    return null;
  }

  return cdnUrlFor(key);
}
