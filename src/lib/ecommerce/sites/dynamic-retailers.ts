import { z } from "zod";
import { cacheGet, cacheSet } from "@/lib/cache/provider";
import { locationToRegion } from "@/lib/ecommerce/discovery";
import { isPrivateOrLocalHost } from "@/lib/security/ssrf";

/** Passed to the Playwright crawler as a per-generation site override. */
export type RetailerSiteOverride = {
  name: string;
  domain: string;
  searchUrlTemplate: string;
  engine?: "playwright" | "httpx";
  priority?: number;
};

const retailerSiteSchema = z.object({
  name: z.string().min(1).max(80),
  domain: z.string().min(3).max(120),
  searchUrlTemplate: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), "must be https")
    .refine(
      (u) => u.includes("{query}") || u.includes("{slug_query}"),
      "must contain {query} or {slug_query}"
    ),
  engine: z.enum(["playwright", "httpx"]).optional(),
  priority: z.number().int().min(1).max(99).optional(),
});

function registrableDomain(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

function isBlockedHost(template: string): boolean {
  try {
    const sample = template
      .replace("{query}", "test")
      .replace("{slug_query}", "test");
    const host = new URL(sample).hostname;
    if (isPrivateOrLocalHost(host)) return true;
    if (!host.includes(".")) return true;
    // Block IP literals and link-local ranges the hostname helper covers.
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return true;
    return false;
  } catch {
    return true;
  }
}

function templateHostMatchesDomain(template: string, domain: string): boolean {
  try {
    const sample = template
      .replace("{query}", "test")
      .replace("{slug_query}", "test");
    const host = registrableDomain(new URL(sample).hostname);
    const d = registrableDomain(domain);
    return host === d || host.endsWith(`.${d}`) || d.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

export function sanitizeRetailerSites(
  raw: unknown,
  max = 25
): RetailerSiteOverride[] {
  if (!Array.isArray(raw)) return [];
  const out: RetailerSiteOverride[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (out.length >= max) break;
    const parsed = retailerSiteSchema.safeParse(entry);
    if (!parsed.success) continue;
    const { name, domain, searchUrlTemplate, engine, priority } = parsed.data;
    if (isBlockedHost(searchUrlTemplate)) continue;
    const key = registrableDomain(domain);
    if (!templateHostMatchesDomain(searchUrlTemplate, key)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name: name.trim(),
      domain: key,
      searchUrlTemplate,
      engine: engine ?? "playwright",
      priority: priority ?? 10,
    });
  }
  return out;
}

/** Tier-1 static fallback when GPT omits or fails validation. */
const STATIC_FALLBACK: Record<"IN" | "US" | "UK", RetailerSiteOverride[]> = {
  IN: [
    {
      name: "Amazon India",
      domain: "amazon.in",
      searchUrlTemplate: "https://www.amazon.in/s?k={query}",
      priority: 1,
    },
    {
      name: "Myntra",
      domain: "myntra.com",
      searchUrlTemplate: "https://www.myntra.com/{slug_query}",
      priority: 1,
    },
    {
      name: "Ajio",
      domain: "ajio.com",
      searchUrlTemplate: "https://www.ajio.com/search/?text={query}",
      priority: 1,
    },
    {
      name: "Flipkart",
      domain: "flipkart.com",
      searchUrlTemplate: "https://www.flipkart.com/search?q={query}",
      priority: 1,
    },
    {
      name: "Nykaa Fashion",
      domain: "nykaafashion.com",
      searchUrlTemplate:
        "https://www.nykaafashion.com/search/result/?query={query}",
      priority: 1,
    },
    {
      name: "Tata CLiQ",
      domain: "tatacliq.com",
      searchUrlTemplate:
        "https://www.tatacliq.com/search/?searchCategory=all&text={query}",
      priority: 1,
    },
    {
      name: "Meesho",
      domain: "meesho.com",
      searchUrlTemplate: "https://www.meesho.com/search?q={query}",
      priority: 1,
    },
    {
      name: "Zara India",
      domain: "zara.com",
      searchUrlTemplate:
        "https://www.zara.com/in/en/search?searchTerm={query}",
      priority: 2,
    },
    {
      name: "H&M India",
      domain: "hm.com",
      searchUrlTemplate:
        "https://www2.hm.com/en_in/search-results.html?q={query}",
      priority: 2,
    },
    {
      name: "Uniqlo India",
      domain: "uniqlo.com",
      searchUrlTemplate: "https://www.uniqlo.com/in/en/search?q={query}",
      priority: 2,
    },
    {
      name: "ASOS",
      domain: "asos.com",
      searchUrlTemplate:
        "https://www.asos.com/api/product/search/v2/?q={query}&channel=desktop-web&store=COM&limit=48",
      engine: "httpx",
      priority: 2,
    },
    {
      name: "Westside",
      domain: "westside.com",
      searchUrlTemplate: "https://www.westside.com/search?q={query}",
      priority: 2,
    },
    {
      name: "Lifestyle",
      domain: "lifestylestores.com",
      searchUrlTemplate:
        "https://www.lifestylestores.com/in/en/search?q={query}",
      priority: 2,
    },
    {
      name: "Max Fashion",
      domain: "maxfashion.in",
      searchUrlTemplate: "https://www.maxfashion.in/in/en/search?q={query}",
      priority: 2,
    },
    {
      name: "Bewakoof",
      domain: "bewakoof.com",
      searchUrlTemplate: "https://www.bewakoof.com/search?q={query}",
      priority: 3,
    },
    {
      name: "Banana Club",
      domain: "bananaclub.co.in",
      searchUrlTemplate:
        "https://www.bananaclub.co.in/search.json?q={query}&type=product",
      engine: "httpx",
      priority: 4,
    },
    {
      name: "Snitch",
      domain: "snitch.com",
      searchUrlTemplate: "https://www.snitch.com/search?q={query}",
      engine: "playwright",
      priority: 4,
    },
  ],
  US: [
    {
      name: "Amazon US",
      domain: "amazon.com",
      searchUrlTemplate: "https://www.amazon.com/s?k={query}",
      priority: 1,
    },
    {
      name: "Zara US",
      domain: "zara.com",
      searchUrlTemplate:
        "https://www.zara.com/us/en/search?searchTerm={query}",
      priority: 1,
    },
    {
      name: "H&M US",
      domain: "hm.com",
      searchUrlTemplate:
        "https://www2.hm.com/en_us/search-results.html?q={query}",
      priority: 1,
    },
    {
      name: "ASOS",
      domain: "asos.com",
      searchUrlTemplate:
        "https://www.asos.com/api/product/search/v2/?q={query}&channel=desktop-web&store=US&limit=48",
      engine: "httpx",
      priority: 1,
    },
  ],
  UK: [
    {
      name: "Amazon UK",
      domain: "amazon.co.uk",
      searchUrlTemplate: "https://www.amazon.co.uk/s?k={query}",
      priority: 1,
    },
    {
      name: "Zara UK",
      domain: "zara.com",
      searchUrlTemplate:
        "https://www.zara.com/uk/en/search?searchTerm={query}",
      priority: 1,
    },
    {
      name: "H&M UK",
      domain: "hm.com",
      searchUrlTemplate:
        "https://www2.hm.com/en_gb/search-results.html?q={query}",
      priority: 1,
    },
    {
      name: "ASOS",
      domain: "asos.com",
      searchUrlTemplate:
        "https://www.asos.com/api/product/search/v2/?q={query}&channel=desktop-web&store=COM&limit=48",
      engine: "httpx",
      priority: 1,
    },
  ],
};

export function staticFallbackSites(region: "IN" | "US" | "UK"): RetailerSiteOverride[] {
  return STATIC_FALLBACK[region].map((s) => ({ ...s }));
}

function mergeSites(
  gptSites: RetailerSiteOverride[],
  region: "IN" | "US" | "UK"
): RetailerSiteOverride[] {
  const merged: RetailerSiteOverride[] = [];
  const seen = new Set<string>();

  const add = (site: RetailerSiteOverride) => {
    const key = registrableDomain(site.domain);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push({ ...site, domain: key });
  };

  for (const s of staticFallbackSites(region)) add(s);
  for (const s of gptSites) add(s);
  return merged.slice(0, 25);
}

function retailerSitesCacheKey(params: {
  region: "IN" | "US" | "UK";
  styleType?: string;
  occasion?: string;
}): string {
  const st = (params.styleType ?? "any").toLowerCase().slice(0, 40);
  const oc = (params.occasion ?? "any").toLowerCase().slice(0, 40);
  return `retailer-sites:v2:${params.region}:${st}:${oc}`;
}

function cacheTtlSeconds(): number {
  const n = Number(process.env.RETAILER_SITES_CACHE_TTL_SECONDS ?? 86400);
  return Number.isFinite(n) && n > 0 ? n : 86400;
}

/**
 * Sanitize GPT output, merge with static tier-1 fallback, and cache by context.
 */
export async function resolveRetailerSites(params: {
  location?: string | null;
  region?: "IN" | "US" | "UK";
  styleType?: string;
  occasion?: string;
  gptSites?: unknown;
}): Promise<RetailerSiteOverride[]> {
  const region = params.region ?? locationToRegion(params.location);
  const sanitized = sanitizeRetailerSites(params.gptSites);
  const merged = mergeSites(sanitized, region);

  if (sanitized.length >= 5) {
    const key = retailerSitesCacheKey({
      region,
      styleType: params.styleType,
      occasion: params.occasion,
    });
    await cacheSet(key, merged, cacheTtlSeconds()).catch(() => undefined);
    return merged;
  }

  const key = retailerSitesCacheKey({
    region,
    styleType: params.styleType,
    occasion: params.occasion,
  });
  const cached = await cacheGet<RetailerSiteOverride[]>(key);
  if (cached?.length) {
    return mergeSites([...cached, ...sanitized], region);
  }

  return merged;
}

/** Shape sent to the Python crawler API. */
export function sitesForCrawlerApi(
  sites: RetailerSiteOverride[]
): Array<{
  name: string;
  domain: string;
  search_url_template: string;
  engine?: string;
  priority?: number;
}> {
  return sites.map((s) => ({
    name: s.name,
    domain: s.domain,
    search_url_template: s.searchUrlTemplate,
    engine: s.engine,
    priority: s.priority,
  }));
}
