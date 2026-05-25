import { v2 as cloudinary } from "cloudinary";

export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function ensureCloudinaryConfig(): void {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    throw new Error("Cloudinary env vars are not set");
  }
  cloudinary.config({ cloud_name, api_key, api_secret });
}

const CLOUD_PREFIX = "cloudinary:";

export function isCloudinaryBlobPath(blobPath: string): boolean {
  return blobPath.startsWith(CLOUD_PREFIX);
}

export function cloudinaryPublicIdFromBlobPath(blobPath: string): string {
  return blobPath.slice(CLOUD_PREFIX.length);
}

export function getCloudinaryReadUrl(
  publicId: string,
  opts?: { width?: number }
): string | null {
  if (!isCloudinaryConfigured()) return null;
  ensureCloudinaryConfig();
  return cloudinary.url(publicId, {
    secure: true,
    ...(opts?.width
      ? { width: opts.width, crop: "limit" as const }
      : {}),
  });
}

export async function uploadImageBuffer(params: {
  buffer: Buffer;
  /** Logical folder, e.g. aurafit/<clerkUserId>/wardrobe */
  folder: string;
  /** Filename stem (safe chars) */
  publicIdStem: string;
}): Promise<{ blobPath: string; url: string }> {
  ensureCloudinaryConfig();
  const { buffer, folder, publicIdStem } = params;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicIdStem,
        resource_type: "image",
        overwrite: false,
      },
      (err, result) => {
        if (err || !result?.public_id || !result.secure_url) {
          reject(err ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve({
          blobPath: `${CLOUD_PREFIX}${result.public_id}`,
          url: result.secure_url,
        });
      }
    );
    stream.end(buffer);
  });
}
