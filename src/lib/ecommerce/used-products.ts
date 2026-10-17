import {
  normalizeProductUrl,
  retailerDomain,
  titleFingerprint,
} from "./fingerprint";

export type ClaimOptions = {
  /** Recovery passes may exceed the per-retailer cap rather than leave a slot empty. */
  relaxRetailerCap?: boolean;
};

function boardMaxPerRetailer(): number {
  const n = Number(process.env.BOARD_MAX_PER_RETAILER ?? 3);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 8) : 3;
}

/**
 * Board-level uniqueness: same URL, near-duplicate title, or too many items
 * from one retailer cannot be claimed twice in a single generation.
 */
export class UsedProductTracker {
  private urls = new Set<string>();
  private fingerprints = new Set<string>();
  private burned = new Set<string>();
  private perRetailer = new Map<string, number>();
  private readonly maxPerRetailer: number;

  constructor(maxPerRetailer?: number) {
    this.maxPerRetailer = maxPerRetailer ?? boardMaxPerRetailer();
  }

  isAvailable(
    url: string | undefined | null,
    title?: string | null,
    opts: ClaimOptions = {}
  ): boolean {
    if (!url) return false;
    const nu = normalizeProductUrl(url);
    if (this.urls.has(nu) || this.burned.has(nu)) return false;
    const fp = title ? titleFingerprint(title) : "";
    if (fp && this.fingerprints.has(fp)) return false;
    if (!opts.relaxRetailerCap && this.retailerAtCap(url)) return false;
    return true;
  }

  tryClaim(
    url: string | undefined | null,
    title?: string | null,
    opts: ClaimOptions = {}
  ): boolean {
    if (!this.isAvailable(url, title, opts)) return false;
    const nu = normalizeProductUrl(url!);
    this.urls.add(nu);
    const fp = title ? titleFingerprint(title) : "";
    if (fp) this.fingerprints.add(fp);
    const domain = retailerDomain(url);
    if (domain) {
      this.perRetailer.set(domain, (this.perRetailer.get(domain) ?? 0) + 1);
    }
    return true;
  }

  /** Undo a claim so a failed PDP check can fall back to the next candidate. */
  release(url: string | undefined | null, title?: string | null): void {
    if (!url) return;
    const nu = normalizeProductUrl(url);
    this.urls.delete(nu);
    const fp = title ? titleFingerprint(title) : "";
    if (fp) this.fingerprints.delete(fp);
    const domain = retailerDomain(url);
    if (domain) {
      const next = (this.perRetailer.get(domain) ?? 1) - 1;
      if (next <= 0) this.perRetailer.delete(domain);
      else this.perRetailer.set(domain, next);
    }
  }

  /** Permanently skip a dead listing without counting it against the retailer cap. */
  burn(url: string | undefined | null): void {
    if (!url) return;
    this.burned.add(normalizeProductUrl(url));
  }

  retailerCount(url: string | undefined | null): number {
    const domain = retailerDomain(url);
    if (!domain) return 0;
    return this.perRetailer.get(domain) ?? 0;
  }

  private retailerAtCap(url: string): boolean {
    const domain = retailerDomain(url);
    if (!domain) return false;
    return (this.perRetailer.get(domain) ?? 0) >= this.maxPerRetailer;
  }
}

/**
 * Shuffle the first `k` items (quality-preserving diversity) and append the rest
 * in original rank order as fallbacks.
 */
export function sampleTopK<T>(items: T[], k = 3): T[] {
  const head = items.slice(0, Math.max(0, k));
  const rest = items.slice(head.length);
  for (let i = head.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = head[i]!;
    head[i] = head[j]!;
    head[j] = tmp;
  }
  return [...head, ...rest];
}
