/**
 * SSRF guards for server-side URL fetchers (image gen, vision, wardrobe).
 * Blocks localhost, link-local, metadata, and private IP targets.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google",
  "kubernetes.default.svc",
]);

const METADATA_IPV4 = "169.254.169.254";

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function parseIpv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums;
}

function isPrivateOrReservedIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".local")) return true;
  if (host.endsWith(".internal")) return true;
  if (host === METADATA_IPV4) return true;

  if (host.startsWith("[") && host.endsWith("]")) {
    const inner = host.slice(1, -1).toLowerCase();
    if (inner === "::1" || inner.startsWith("fe80:") || inner.startsWith("fc") || inner.startsWith("fd")) {
      return true;
    }
    return false;
  }

  const v4 = parseIpv4(host);
  if (v4) return isPrivateOrReservedIpv4(v4);

  return false;
}

function hostnameMatchesAllowed(host: string, allowed: string): boolean {
  const h = host.toLowerCase();
  const a = allowed.toLowerCase();
  return h === a || h.endsWith(`.${a}`);
}

function collectAllowedMediaHosts(): string[] {
  const hosts = new Set<string>([
    "res.cloudinary.com",
    "blob.core.windows.net",
  ]);

  const cdn = process.env.NEXT_PUBLIC_CDN_URL ?? process.env.AZURE_CDN_ENDPOINT;
  if (cdn) {
    try {
      hosts.add(new URL(cdn).hostname.toLowerCase());
    } catch {
      /* ignore invalid env */
    }
  }

  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME?.toLowerCase();
  if (account) {
    hosts.add(`${account}.blob.core.windows.net`);
  }

  const extra = process.env.ALLOWED_MEDIA_URL_HOSTS ?? "";
  for (const part of extra.split(",")) {
    const h = part.trim().toLowerCase();
    if (h) hosts.add(h);
  }

  return [...hosts];
}

/** Reject URLs that must never be fetched by the server (SSRF). */
export function assertSafeExternalUrl(
  raw: string,
  options?: { allowedHosts?: string[] }
): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError("Only http(s) URLs are allowed");
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError("URLs with credentials are not allowed");
  }

  const host = parsed.hostname;
  if (isPrivateOrLocalHost(host)) {
    throw new UnsafeUrlError("URL targets a blocked or private host");
  }

  if (options?.allowedHosts?.length) {
    const ok = options.allowedHosts.some((a) => hostnameMatchesAllowed(host, a));
    if (!ok) {
      throw new UnsafeUrlError("URL host is not in the allowlist");
    }
  }

  return parsed;
}

/** User-uploaded media must come from configured storage/CDN hosts only. */
export function assertAllowedUserMediaUrl(raw: string): URL {
  return assertSafeExternalUrl(raw, {
    allowedHosts: collectAllowedMediaHosts(),
  });
}

export function isAllowedUserMediaUrl(raw: string): boolean {
  try {
    assertAllowedUserMediaUrl(raw);
    return true;
  } catch {
    return false;
  }
}
