const DIRECT_HOSTS = new Set([
  "res.cloudinary.com",
  "img.clerk.com",
  "images.unsplash.com",
]);

function isDirectHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (DIRECT_HOSTS.has(host)) return true;
  if (host === "blob.core.windows.net" || host.endsWith(".blob.core.windows.net")) {
    return true;
  }
  if (host === "azureedge.net" || host.endsWith(".azureedge.net")) {
    return true;
  }
  return false;
}

/** Same-origin proxy for retailer CDNs; pass through first-party / blob / data URLs. */
export function displayProductImageSrc(
  url: string | undefined
): string | undefined {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (isDirectHost(parsed.hostname)) {
      return trimmed;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return `/api/media/product?url=${encodeURIComponent(trimmed)}`;
  } catch {
    return undefined;
  }
}
