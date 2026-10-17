import { assertSafeExternalUrl } from "@/lib/security/ssrf";

/** Chrome UA so retailer CDNs that block empty/bot agents still return the image. */
export const PRODUCT_IMAGE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export const MAX_PRODUCT_PROXY_BYTES = 2 * 1024 * 1024;

const ALLOWED_PRODUCT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function assertProductProxyUrl(raw: string): URL {
  return assertSafeExternalUrl(raw);
}

export function isAllowedProductProxyContentType(contentType: string): boolean {
  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!mime || mime === "image/svg+xml") return false;
  return ALLOWED_PRODUCT_IMAGE_TYPES.has(mime);
}
