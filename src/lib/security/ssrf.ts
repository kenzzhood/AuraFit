/**
 * SSRF guards for server-side URL fetchers (image gen, vision, wardrobe).
 * Blocks localhost, link-local, metadata, private IPs, and IPv4-mapped IPv6.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google",
  "kubernetes.default.svc",
]);

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

/** Parse ::ffff:a.b.c.d or ::ffff:AABB:CCDD into IPv4 octets. */
function ipv4MappedFromIpv6(inner: string): number[] | null {
  const lower = inner.toLowerCase();
  const m = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (m) return parseIpv4(m[1]!);
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1]!, 16);
    const lo = parseInt(hex[2]!, 16);
    if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
    return [(hi >> 8) & 0xff, hi & 0xff, (lo >> 8) & 0xff, lo & 0xff];
  }
  return null;
}

function isPrivateOrLocalIpv6(inner: string): boolean {
  const v = inner.toLowerCase();
  if (v === "::1" || v === "0:0:0:0:0:0:0:1") return true;
  if (v.startsWith("fe80:")) return true; // link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // ULA
  if (v.startsWith("ff")) return true; // multicast
  const mapped = ipv4MappedFromIpv6(v);
  if (mapped) return isPrivateOrReservedIpv4(mapped);
  return false;
}

export function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".local")) return true;
  if (host.endsWith(".internal")) return true;

  if (host.startsWith("[") && host.endsWith("]")) {
    return isPrivateOrLocalIpv6(host.slice(1, -1));
  }

  // Unbracketed IPv6 (rare in URL.hostname for Node, but be safe)
  if (host.includes(":") && !host.includes(".")) {
    return isPrivateOrLocalIpv6(host);
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

/**
 * Safe server-side fetch: validates URL, disables automatic redirect following
 * past the first hop unless each Location also passes assertSafeExternalUrl.
 */
export async function safeFetch(
  raw: string,
  init?: RequestInit & { maxRedirects?: number }
): Promise<Response> {
  const maxRedirects = init?.maxRedirects ?? 3;
  let current = assertSafeExternalUrl(raw).toString();
  const { maxRedirects: _m, redirect: _r, ...rest } = init ?? {};

  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current, { ...rest, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        throw new UnsafeUrlError("Redirect without Location header");
      }
      const next = new URL(loc, current).toString();
      assertSafeExternalUrl(next);
      current = next;
      continue;
    }
    return res;
  }
  throw new UnsafeUrlError("Too many redirects");
}
