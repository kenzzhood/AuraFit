import { JobStatus, JobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { persistChatJobResultToMessages } from "@/lib/jobs/persist-chat-result";
import { generateJobSchema } from "@/types/api";
import {
  discoverProducts,
  discoverProductsBatch,
  locationToRegion,
} from "@/lib/ecommerce/discovery";
import {
  resolveRetailerSites,
  type RetailerSiteOverride,
} from "@/lib/ecommerce/sites/dynamic-retailers";
import { productToNormalized } from "@/lib/ecommerce/product";
import type { Product } from "@/lib/ecommerce/product";
import type { NormalizedProduct } from "@/lib/ecommerce/providers/types";
import type { ProductQuery } from "@/lib/ecommerce/providers/types";
import { dedupeProducts } from "@/lib/ecommerce/dedupe";
import { rankProductList } from "@/lib/ecommerce/ranking";
import { resolveProductUrl } from "@/lib/ecommerce/providers/crawl-live";
import { UsedProductTracker } from "@/lib/ecommerce/used-products";
import { heroSearchVariants } from "@/lib/ecommerce/hero-queries";
import { needsPdpVerification } from "@/lib/ecommerce/buyability";
import { rerankOutfitCombos } from "@/lib/ecommerce/combo-rerank";
import {
  isCrawlerCircuitOpen,
  resetCrawlerCircuit,
} from "@/lib/ecommerce/providers/google-shopping";
import {
  generateLooksWithFallback,
  isImageGenerationConfigured,
} from "@/lib/ai/provider";
import type { WardrobeContext } from "@/lib/ai/providers/types";
import { padLooksToCount, resolveLookCount } from "@/lib/ai/providers/azure";
import {
  generateBoardWithFallback,
} from "@/lib/image/provider";
import { prefetchProductImageUrls } from "@/lib/azure/images";
import { MAX_PRODUCT_IMAGE_REFS } from "@/lib/image/constants";
import { mergeProviderMeta } from "@/lib/providers/fallback";
import type { ProviderMeta } from "@/types/generation";
import type { RenderQuality } from "@/types/generation";
import {
  analyzePersonPhoto,
  personAnalysisToPromptBlock,
} from "@/lib/ai/person-analysis";
import type { QueueJobPayload } from "@/lib/queue/producer";
import { resolveWardrobeItemReadUrl } from "@/lib/storage/item-read-url";
import { describeGarment } from "@/lib/ai/garment-classifier";
import { isCloudinaryConfigured, uploadImageBuffer } from "@/lib/storage/cloudinary";
import { getStorageProvider } from "@/lib/storage/provider";
import type {
  GenerationJobResult,
  GenerationLookResult,
  LookProduct,
  PersonAnalysis,
  PlannedLook,
} from "@/types/generation";
import {
  audienceFromGender,
  canonicalItemCategory,
  genericSlotQueries,
  productMatchesSlot,
  slotSearchQuery,
  slotSearchVariants,
} from "@/lib/ecommerce/category-match";
import {
  aestheticNeedsOuterwear,
  classifyFashionAesthetic,
  fallbackLookItems,
  joinShoppingStyle,
  type FashionAesthetic,
} from "@/lib/ecommerce/aesthetic";
import {
  isUsableShopUrl,
  pickUsableShopUrl,
  usableMerchantUrl,
} from "@/lib/ecommerce/fingerprint";

const AZURE_WARDROBE_CONTAINER =
  process.env.AZURE_STORAGE_CONTAINER_WARDROBES ?? "wardrobes";

async function billingReservationIdFromJob(
  jobId: string
): Promise<string | null> {
  const row = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { payload: true },
  });
  const payload = row?.payload as { billingReservationId?: unknown } | null;
  return typeof payload?.billingReservationId === "string"
    ? payload.billingReservationId
    : null;
}

async function failJob(jobId: string, message: string) {
  const reservationId = await billingReservationIdFromJob(jobId);
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: JobStatus.FAILED, error: message },
  });
  if (reservationId) {
    const { finalizeUsage } = await import("@/lib/billing/entitlements");
    await finalizeUsage(reservationId, false, jobId).catch(() => undefined);
  }
}

export async function cacheProduct(p: NormalizedProduct) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const productUrl = pickUsableShopUrl(p.canonicalUrl, p.productUrl);
  if (!productUrl) {
    throw new Error("Refusing to cache unusable shop URL");
  }
  return prisma.productCache.upsert({
    where: {
      source_externalId: { source: p.source, externalId: p.externalId },
    },
    create: {
      externalId: p.externalId,
      source: p.source,
      title: p.title,
      price: p.price != null ? Math.round(p.price) : undefined,
      currency: p.currency,
      imageUrl: p.imageUrl,
      productUrl,
      category: p.category,
      expiresAt,
    },
    update: {
      title: p.title,
      price: p.price != null ? Math.round(p.price) : undefined,
      currency: p.currency,
      imageUrl: p.imageUrl,
      productUrl,
      category: p.category,
      expiresAt,
    },
  });
}

/**
 * Per-panel reference to a real product image passed into the image edit call.
 * `imageIndex` is 1-based and starts at 2 — Image 1 is always the user's
 * reference photo. The generator is instructed to use the garment from that
 * specific image when rendering the panel.
 *
 * `category` should be one of the canonical slots (outerwear, top, bottom,
 * shoes, accessory) so the prompt can name the garment explicitly per panel.
 */
export type ProductImageRef = {
  lookIndex: number;
  imageIndex: number;
  category: string;
  title: string;
  /** Where this product is sold ("flipkart", "amazon", etc.) */
  source?: string;
  /** Thumbnail URL — used to keep shop links tied to uploaded images. */
  imageUrl: string;
};

// Cap at 3 (dress, or outerwear+top+bottom) — more slots explode crawler time
// without making the board more shoppable under the image-ref cap. Do not
// key this off items.length: injecting a missing blazer would otherwise
// get sliced away on a 2-item dressy plan.
function maxSlotsForLook(): number {
  return 3;
}

/**
 * Parallel slot resolution is safe when discovery can hit the owned pgvector
 * index or SerpAPI (HTTP). Only defer to sequential primary-slot resolution
 * when the sync Playwright crawler is the sole source.
 */
function fastShoppingConfigured(): boolean {
  if (process.env.SERPAPI_KEY) return true;
  const layers =
    process.env.PRODUCT_DISCOVERY_LAYERS ?? "cache,index,shopping,crawl";
  return layers.includes("index") || layers.includes("shopping");
}

// How many looks to resolve in parallel. SerpAPI can fan out; without it
// every hero slot shares the crawler's 3-search semaphore.
function lookConcurrency(): number {
  // Without SerpAPI every hero slot shares the crawler's 3-search semaphore.
  // 4-way look fan-out just queues 20s timeouts and blows the 2-minute budget.
  const def = process.env.SERPAPI_KEY ? 4 : 3;
  const n = Number(process.env.PRODUCT_LOOK_CONCURRENCY ?? def);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 8) : def;
}
// How many slots within a single look to resolve in parallel. Supporting
// slots skip live shopping when SerpAPI is off, so 2 is enough.
function slotConcurrency(): number {
  return process.env.SERPAPI_KEY ? 3 : 2;
}
/** Hard cap on sync crawl attempts per missing slot during recovery. */
const MAX_SLOT_QUERY_ATTEMPTS = 2;
// Re-exported so existing imports (hd-render, tests) keep working — the
// constant lives in @/lib/image/constants to avoid an import cycle with
// azure/images.
export { MAX_PRODUCT_IMAGE_REFS };

/**
 * Build the image-edit ingredient list (user photo = Image 1, then each unique
 * real product image = Image 2..N) plus the per-panel `productImageRefs` that
 * tell the prompt which Image maps to which look + slot. Shared by the initial
 * board render and the HD re-render so HD matches the real products exactly.
 */
export function buildProductImageRefs(
  looksProducts: Array<{ products: LookProduct[] }>,
  opts: { includeWardrobe?: boolean } = {}
): { productImageUrls: string[]; productImageRefs: ProductImageRef[] } {
  type Candidate = {
    lookIndex: number;
    category: string;
    title: string;
    source?: string;
    imageUrl: string;
    priority: number;
  };
  const candidates: Candidate[] = [];

  looksProducts.forEach((res, lookIndex) => {
    for (const p of res.products ?? []) {
      if (!p.imageUrl) continue;
      const isWardrobe = p.kind === "wardrobe";
      if (isWardrobe) {
        if (!opts.includeWardrobe || p.verified !== true) continue;
      } else if (!isShoppableOnlineProduct(p)) {
        continue;
      }
      const category = categoryForBoardRef(p);
      candidates.push({
        lookIndex,
        category,
        title: p.title ?? "product",
        source: p.source,
        imageUrl: p.imageUrl,
        priority: productSlotPriority(category),
      });
    }
  });

  // Round-robin across looks so panel 5 still gets a real garment when the
  // image-edit cap is 8. Filling look 0 then look 1 left later panels with
  // invented clothes that did not match the shop links.
  const byLook = new Map<number, Candidate[]>();
  for (const c of candidates) {
    const arr = byLook.get(c.lookIndex) ?? [];
    arr.push(c);
    byLook.set(c.lookIndex, arr);
  }
  for (const arr of byLook.values()) {
    arr.sort(
      (a, b) => a.priority - b.priority || a.title.localeCompare(b.title)
    );
  }
  const lookIndices = [...byLook.keys()].sort((a, b) => a - b);
  const maxDepth = Math.max(0, ...[...byLook.values()].map((a) => a.length));
  const ordered: Candidate[] = [];
  for (let depth = 0; depth < maxDepth; depth++) {
    for (const li of lookIndices) {
      const c = byLook.get(li)?.[depth];
      if (c) ordered.push(c);
    }
  }

  const productImageUrls: string[] = [];
  const taken = new Set<string>();
  const takeUrl = (url: string): boolean => {
    if (taken.has(url)) return true;
    if (productImageUrls.length >= MAX_PRODUCT_IMAGE_REFS) return false;
    taken.add(url);
    productImageUrls.push(url);
    return true;
  };

  for (const c of ordered) {
    takeUrl(c.imageUrl);
  }

  const lookHasUrl = (li: number) =>
    (byLook.get(li) ?? []).some((c) => taken.has(c.imageUrl));

  const stealExtraUrl = (): string | undefined => {
    for (let i = productImageUrls.length - 1; i >= 0; i--) {
      const url = productImageUrls[i]!;
      for (const li of lookIndices) {
        const arr = byLook.get(li) ?? [];
        const depth = arr.findIndex((c) => c.imageUrl === url);
        if (depth < 1) continue;
        const cat = canonicalItemCategory(arr[depth]!.category);
        if (cat !== "accessory" && cat !== "shoes") continue;
        const unique = new Set(
          arr.filter((c) => taken.has(c.imageUrl)).map((c) => c.imageUrl)
        );
        if (unique.size >= 2) return url;
      }
    }
    return undefined;
  };

  for (const li of lookIndices) {
    if (lookHasUrl(li)) continue;
    const primary = byLook.get(li)?.[0];
    if (!primary || taken.has(primary.imageUrl)) continue;
    if (productImageUrls.length >= MAX_PRODUCT_IMAGE_REFS) {
      const victim = stealExtraUrl();
      if (!victim) continue;
      const idx = productImageUrls.indexOf(victim);
      if (idx >= 0) productImageUrls.splice(idx, 1);
      taken.delete(victim);
    }
    takeUrl(primary.imageUrl);
  }

  const urlToImageIndex = new Map(
    productImageUrls.map((url, i) => [url, i + 2] as const)
  );
  const productImageRefs: ProductImageRef[] = [];
  for (const c of ordered) {
    const imageIndex = urlToImageIndex.get(c.imageUrl);
    if (imageIndex == null) continue;
    productImageRefs.push({
      lookIndex: c.lookIndex,
      imageIndex,
      category: c.category,
      title: c.title,
      source: c.source,
      imageUrl: c.imageUrl,
    });
  }

  return { productImageUrls, productImageRefs };
}

/**
 * Keep only product refs whose thumbnails actually uploaded, and re-number
 * Image 2..N to match the files sent to the image API. Failed fetches used
 * to collapse the array while the prompt still said "Image 6 = these shoes".
 */
export function compactProductImageRefs(
  refs: ProductImageRef[],
  uploadedUrls: string[]
): ProductImageRef[] {
  const urlToIndex = new Map<string, number>();
  uploadedUrls.forEach((url, i) => {
    if (!urlToIndex.has(url)) urlToIndex.set(url, i + 2);
  });
  return refs
    .filter((r) => urlToIndex.has(r.imageUrl))
    .map((r) => ({
      ...r,
      imageIndex: urlToIndex.get(r.imageUrl)!,
    }));
}

/** Shop links on a look must be the garments whose photos went into the board. */
export function filterProductsToBoardRefs<
  T extends { products: LookProduct[]; sessionId?: string },
>(looksProducts: T[], refs: ProductImageRef[]): T[] {
  return looksProducts.map((row, lookIndex) => {
    const allowed = new Set(
      refs.filter((r) => r.lookIndex === lookIndex).map((r) => r.imageUrl)
    );
    return {
      ...row,
      products: row.products.filter(
        (p) => p.imageUrl && allowed.has(p.imageUrl)
      ),
    };
  });
}

function itemsFromBoardProducts(products: LookProduct[]): PlannedLook["items"] {
  return products.map((p) => ({
    category: p.matchCategory ?? "garment",
    description: p.title ?? p.matchCategory ?? "garment",
    searchQuery: p.title,
    wardrobeItemId: p.wardrobeItemId,
  }));
}

/**
 * After prefetch: keep only looks whose product photos actually uploaded,
 * rewrite each look's `items` from those products (so the UI cannot pair
 * "black loafers" with a white-sneaker link), and re-number Image 2..N
 * densely to match the files sent to the image API.
 *
 * If every thumbnail failed, keep looks that still have ≥1 shoppable product
 * with empty refs so chat can complete with shop rows and no board image.
 */
export function finalizeBoardImageRefs<
  T extends { products: LookProduct[]; sessionId?: string },
>(params: {
  looks: PlannedLook[];
  looksProducts: T[];
  refs: ProductImageRef[];
  uploadedUrls: string[];
}): {
  looks: PlannedLook[];
  looksProducts: T[];
  refs: ProductImageRef[];
  productImageUrls: string[];
} {
  const compacted = compactProductImageRefs(params.refs, params.uploadedUrls);
  const uploaded = new Set(params.uploadedUrls);
  const refsWithPrimary = [...compacted];
  for (let lookIndex = 0; lookIndex < params.looksProducts.length; lookIndex++) {
    const row = params.looksProducts[lookIndex]!;
    const restorable = row.products.filter(
      (p) =>
        !!p.imageUrl &&
        uploaded.has(p.imageUrl) &&
        isShoppableOnlineProduct(p)
    );
    const primary = [...restorable].sort(
      (a, b) =>
        productSlotPriority(categoryForBoardRef(a)) -
        productSlotPriority(categoryForBoardRef(b))
    )[0];
    if (!primary?.imageUrl) continue;
    if (
      refsWithPrimary.some(
        (r) => r.lookIndex === lookIndex && r.imageUrl === primary.imageUrl
      )
    ) {
      continue;
    }
    refsWithPrimary.push({
      lookIndex,
      imageIndex: 0,
      category: categoryForBoardRef(primary),
      title: primary.title ?? "product",
      source: primary.source,
      imageUrl: primary.imageUrl,
    });
  }
  const restored = compactProductImageRefs(refsWithPrimary, params.uploadedUrls);
  if (restored.length === 0) {
    const keep = params.looksProducts
      .map((_, i) => i)
      .filter((i) =>
        lookHasShoppableOnlineProduct(params.looksProducts[i]!.products)
      );
    const looks = keep.map((i) => {
      const products = params.looksProducts[i]!.products;
      const shopBrief = briefFromAttachedProducts(products);
      return {
        ...params.looks[i]!,
        description: shopBrief,
        productSearchQuery: shopBrief,
        items: itemsFromBoardProducts(products),
      };
    });
    return {
      looks,
      looksProducts: keep.map((i) => params.looksProducts[i]!),
      refs: [],
      productImageUrls: [],
    };
  }
  const painted = filterProductsToBoardRefs(params.looksProducts, restored);
  // Shop rows keep every resolved product: painted/ref'd garments first, then
  // the rest tail-appended — but only on looks that still have ≥1 image ref.
  const withShopRows = painted.map((row, lookIndex) => {
    const paintedSet = new Set(row.products);
    const rest = params.looksProducts[lookIndex]!.products.filter(
      (p) => !paintedSet.has(p)
    );
    return rest.length ? { ...row, products: [...row.products, ...rest] } : row;
  });
  const keep = withShopRows
    .map((_, i) => i)
    .filter((i) => restored.some((r) => r.lookIndex === i));
  const indexMap = new Map(keep.map((old, neu) => [old, neu] as const));
  const looks = keep.map((i) => {
    const shopBrief = briefFromAttachedProducts(withShopRows[i]!.products);
    return {
      ...params.looks[i]!,
      description: shopBrief,
      productSearchQuery: shopBrief,
      items: itemsFromBoardProducts(painted[i]!.products),
    };
  });
  const looksProducts = keep.map((i) => withShopRows[i]!);
  const remapped = restored
    .filter((r) => indexMap.has(r.lookIndex))
    .map((r) => ({ ...r, lookIndex: indexMap.get(r.lookIndex)! }));
  const productImageUrls = params.uploadedUrls.filter((u) =>
    remapped.some((r) => r.imageUrl === u)
  );
  return {
    looks,
    looksProducts,
    refs: compactProductImageRefs(remapped, productImageUrls),
    productImageUrls,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const current = nextIndex++;
        results[current] = await fn(items[current]!, current);
      }
    })
  );

  return results;
}

function categoryForBoardRef(p: LookProduct): string {
  const fromMeta = canonicalItemCategory(p.matchCategory);
  if (
    fromMeta === "dress" ||
    fromMeta === "top" ||
    fromMeta === "bottom" ||
    fromMeta === "outerwear" ||
    fromMeta === "shoes" ||
    fromMeta === "accessory"
  ) {
    return fromMeta;
  }
  return canonicalItemCategory(p.title ?? "garment");
}

/** Shop-row brief from sourced product titles — never LLM outfit prose. */
function briefFromAttachedProducts(products: LookProduct[]): string {
  return products
    .filter((p) => (p.title ?? "").trim())
    .map((p) => `${categoryForBoardRef(p)}: ${p.title!.trim()}`)
    .join("; ");
}

function productSlotPriority(category: string): number {
  switch (canonicalItemCategory(category)) {
    case "outerwear":
      return 0;
    case "dress":
      return 0;
    case "top":
      return 1;
    case "bottom":
      return 2;
    case "shoes":
      return 3;
    case "accessory":
      return 4;
    default:
      return 9;
  }
}

export function buildFashionBoardPrompt(params: {
  personBlock: string;
  styleType?: string;
  occasion?: string;
  location?: string;
  style?: string;
  budgetMin?: number;
  budgetMax?: number;
  path: "online" | "wardrobe";
  wardrobeSummary?: string;
  looks: PlannedLook[];
  productImageRefs?: ProductImageRef[];
  /** When set, every panel must reference verified product images (online path). */
  requireProductRefsPerPanel?: boolean;
}): string {
  const panelCount = params.looks.length;
  const budget =
    params.budgetMin != null && params.budgetMax != null
      ? `₹${params.budgetMin}–₹${params.budgetMax}`
      : params.budgetMax != null
        ? `up to ₹${params.budgetMax}`
        : "flexible";

  // Build per-panel ingredient lines. When products were sourced we tell the
  // model exactly which Image N corresponds to which garment for each panel so
  // every outfit is composed of items the user can actually buy.
  const refsByLook = new Map<number, ProductImageRef[]>();
  for (const ref of params.productImageRefs ?? []) {
    const arr = refsByLook.get(ref.lookIndex) ?? [];
    arr.push(ref);
    refsByLook.set(ref.lookIndex, arr);
  }

  // Category-ordering for readability — outerwear → dress → top → bottom → shoes → accessory
  const categoryOrder = ["outerwear", "dress", "top", "bottom", "shoes", "accessory"];
  const sortByCategory = (a: ProductImageRef, b: ProductImageRef) => {
    const ai = categoryOrder.indexOf(a.category);
    const bi = categoryOrder.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  };

  const hasProductRefs = (params.productImageRefs?.length ?? 0) > 0;

  const lookLines = params.looks
    .map((l, i) => {
      const head = `PANEL ${i + 1} — "${l.label}"${l.tagline ? ` (${l.tagline})` : ""}`;
      const refs = (refsByLook.get(i) ?? []).slice().sort(sortByCategory);
      if (refs.length) {
        const ingredients = refs
          .map((r) => {
            const store = r.source
              ? `, verified ${r.source[0]!.toUpperCase()}${r.source.slice(1)} product`
              : "";
            return `Use ${r.category} from [Image ${r.imageIndex}] ("${r.title.slice(0, 80)}"${store})`;
          })
          .join(". ");
        const shoesReferenced = refs.some((r) => r.category === "shoes");
        const footwearNote = shoesReferenced
          ? ""
          : " If shoes are NOT referenced: barefoot or skin-tone / barely-visible footwear — not a distinct shoe product.";
        return `${head} ${ingredients}. The person wears ONLY the referenced garments. Distinct shoppable-looking items MUST equal ${refs.length} (the number of Use-Image instructions). Render each garment with exact fidelity to its reference image — same colour, fabric, pattern, cut, and details. Do NOT invent or substitute garments for any referenced slot. Do not invent extra shoppable pieces — no extra jacket, bag, distinct shoes, or extra dress.${footwearNote}`;
      }
      if (params.requireProductRefsPerPanel) {
        return `${head} No product reference images for this panel — do not invent a full shoppable outfit. Only render plain unbranded basics that match the description. Do not paint a distinct dress, jacket, or shoes users would try to click. Do not invent logos or specific retail products.`;
      }
      return `${head}: ${l.description ?? l.productSearchQuery}. Complete outfit including top, bottom, shoes, and accessories.`;
    })
    .join("\n");

  const ingredientsHeader = params.productImageRefs?.length
    ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERENCE IMAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- [Image 1] is the SUBJECT's reference photo — preserve their face/identity.
- [Image 2] onward are REAL product photographs of items that are actually for sale right now.
- For every panel, use ONLY the garments named in that panel's "Use ..." instructions.
- Match each referenced product 1:1: colour, fabric, pattern, cut, logo placement, hardware.
- Do NOT substitute, restyle, or invent new pieces for any slot that has a referenced image.
- Distinct shoppable-looking items in a panel MUST equal that panel's Use-Image instruction count. Ban extra jacket, bag, distinct shoes, extra dress.
- If shoes are not referenced in a panel, render the subject barefoot or in skin-tone / barely-visible footwear — not a distinct shoe product.\n`
    : "";

  return `You are an elite celebrity fashion stylist and luxury editorial creative director. Generate ONE single ultra-premium fashion styling board image.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUBJECT IDENTITY (APPLY TO ALL ${panelCount} PANELS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${params.personBlock}
${ingredientsHeader}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STYLING CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Style: ${joinShoppingStyle({ styleType: params.styleType, occasion: params.occasion, style: params.style }) || "smart casual"}
- Occasion: ${params.occasion ?? "daily outing"}
- Location & climate: ${params.location ?? "India"}
- Aesthetic preference: ${params.style ?? "modern premium, wearable fashion"}
- Budget: ${budget}
- Mode: ${params.path === "wardrobe" ? "restyling existing wardrobe pieces" : "fresh shopping looks — real-world wearable"}
${params.wardrobeSummary ? `- Existing wardrobe: ${params.wardrobeSummary}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE ${panelCount} LOOKS — ONE PER PANEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${lookLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- ONE single image divided into ${panelCount} equal vertical panels side by side
- Each panel numbered clearly 1–${panelCount} at the top
- Same person, full body head-to-toe, standing naturally in each panel
- ${hasProductRefs ? "Different complete outfit per panel, composed only of that panel's referenced garments — do not add unreferenced shoes, bags, or extra pieces to complete the look" : "Different complete outfit per panel"}
- Clean minimal luxury backdrop — subtle studio or real-world environment matching the occasion

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VISUAL QUALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Hyper-realistic, ultra-detailed, 8K cinematic fashion editorial
- Vogue / GQ / Pinterest luxury aesthetic
- Professional studio lighting with soft cinematic shadows and realistic reflections
- Natural skin texture: visible pores, authentic skin details, zero plastic or AI-smoothed look
- Realistic fabric physics: natural drape, wrinkles, weight, and texture for each material
- Hair rendered with individual strand detail — no helmet-hair
- ${hasProductRefs ? "Referenced footwear and accessories rendered with photographic accuracy — do not invent unreferenced shoes or bags" : "Footwear and accessories rendered with photographic accuracy"}
- Camera realism: Hasselblad / Phase One — sharp, natural lens compression, no distortion

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- The face must be IDENTICAL in all ${panelCount} panels — same skin tone, eye shape, nose, jawline, hairline
- NO identity drift between panels
- NO beautification, symmetry edits, or skin smoothing
- NO AI-looking skin, plastic texture, or fake proportions
- NO unrealistic body changes
- Outfits must be realistic and wearable — no fantasy fashion
- Garments referenced by [Image N] MUST match the product image exactly (colour, fabric, cut)
- If any rule conflicts, identity preservation takes absolute priority`;
}

async function uploadBoardImage(
  userId: string,
  image: { url?: string; buffer?: Buffer }
): Promise<string | null> {
  let buffer = image.buffer;
  if (!buffer && image.url) {
    const res = await fetch(image.url);
    if (!res.ok) return image.url;
    buffer = Buffer.from(await res.arrayBuffer());
  }
  if (!buffer) return image.url ?? null;

  if (isCloudinaryConfigured()) {
    const { url } = await uploadImageBuffer({
      buffer,
      folder: `aurafit/${userId}/outfit_render`,
      publicIdStem: `board-${Date.now()}`,
    });
    return url;
  }

  const storage = getStorageProvider();
  if (storage.isConfigured()) {
    const up = await storage.upload({
      buffer,
      folder: `aurafit/${userId}/outfit_render`,
      publicIdStem: `board-${Date.now()}`,
      contentType: "image/png",
    });
    return up.url;
  }

  return image.url ?? null;
}

function resolveRenderQuality(data: {
  renderQuality?: RenderQuality;
  previewOnly?: boolean;
}): RenderQuality {
  if (data.renderQuality) return data.renderQuality;
  if (data.previewOnly === false) return "hd";
  if (data.previewOnly === true) return "preview";
  if (process.env.GENERATION_PREVIEW_ONLY !== "false") return "preview";
  return "medium";
}

function isJobCancelled(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "cancelled" in payload &&
    !!(payload as { cancelled?: boolean }).cancelled
  );
}

async function planLooks(input: {
  path: "online" | "wardrobe";
  styleType?: string;
  occasion?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  style?: string;
  personAnalysis?: PersonAnalysis | null;
  wardrobeSummary?: string;
  wardrobeContext?: WardrobeContext;
  lookCount?: 2 | 3 | 6;
}): Promise<{ plan: PlannedLook[]; gptRetailerSites: RetailerSiteOverride[] }> {
  const lookCount = resolveLookCount(input);
  const brief = joinShoppingStyle({
    styleType: input.styleType,
    occasion: input.occasion,
    style: input.style,
  });
  const audience = audienceFromGender(input.personAnalysis?.genderPresentation);
  const aesthetic = classifyFashionAesthetic(brief);
  const priceRange =
    input.budgetMin != null && input.budgetMax != null
      ? `₹${input.budgetMin}–₹${input.budgetMax}`
      : undefined;
  const fallback = Array.from({ length: lookCount }, (_, i) => {
    const look = buildSimpleFallbackLook(i, brief, audience, aesthetic);
    return {
      ...look,
      bestFor: input.occasion ?? "Daily wear",
      priceRange,
    };
  });

  try {
    const { value: result } = await generateLooksWithFallback({
      path: input.path,
      styleType: input.styleType,
      occasion: input.occasion,
      location: input.location,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
      style: input.style,
      personAnalysis: input.personAnalysis,
      wardrobeSummary: input.wardrobeSummary,
      wardrobeContext: input.wardrobeContext,
      lookCount,
    });
    const plan = result.looks;
    if (!plan.length) return { plan: fallback, gptRetailerSites: [] };
    return {
      plan: padLooksToCount(plan, lookCount),
      gptRetailerSites: result.retailerSites ?? [],
    };
  } catch (e) {
    console.warn("LLM look planning failed, using fallback:", e);
    return { plan: fallback, gptRetailerSites: [] };
  }
}

/**
 * A product is "real and shoppable" iff:
 *  - it has an `imageUrl` (required as an image-edit ingredient and a UI thumb)
 *  - it has a `productUrl` (not the demo placeholder)
 *  - the crawler validated its detail page → `verified === true`
 *  - it is not explicitly marked out-of-stock
 *
 * Anything failing this is dropped before it ever reaches the user — we never
 * show fake, unverified, or out-of-stock product links.
 */
export function isRealProduct(p: {
  productUrl?: string;
  imageUrl?: string;
  source?: string;
  verified?: boolean;
  availability?: "in_stock" | "out_of_stock" | "unknown";
}): boolean {
  if (!p.productUrl) return false;
  if (!isUsableShopUrl(p.productUrl)) return false;
  if (!p.imageUrl) return false;
  if (p.source === "demo") return false;
  if (/example\.com/i.test(p.productUrl)) return false;
  if (p.verified !== true) return false;
  if (p.availability === "out_of_stock") return false;
  return true;
}

function isShoppableOnlineProduct(p: LookProduct): boolean {
  if (p.kind === "wardrobe") return false;
  return isRealProduct({
    productUrl: p.productUrl,
    imageUrl: p.imageUrl,
    source: p.source,
    verified: p.verified,
    availability: p.availability,
  });
}

function lookHasShoppableOnlineProduct(products: LookProduct[]): boolean {
  return products.some(isShoppableOnlineProduct);
}

export function isDressCentricLook(look: PlannedLook): boolean {
  const slots = (look.items ?? []).map((it) =>
    canonicalItemCategory(it.category)
  );
  if (slots.includes("dress")) return true;

  // Do not classify from canonicalItemCategory(fullHaystack) — a jacket token
  // would win and hide a midi/dress in the same phrase.
  const hay = `${look.label} ${look.description ?? ""} ${look.productSearchQuery}`
    .toLowerCase()
    .replace(/dress\s+shirt/g, " ")
    .replace(/wrap\s+shirt/g, " ");
  if (/\bskirt\b/.test(hay) && !/\bdress\b/.test(hay)) return false;
  return /\b(dress|gown|jumpsuit|romper|saree|sari|lehenga|midi|maxi|bodycon)\b/.test(
    hay
  );
}

/** Core outfit slots that must be verified. Outerwear is required for dressy aesthetics. */
export function requiredPrimaryCategories(
  planned: PlannedLook,
  brief?: string
): string[] {
  if (isDressCentricLook(planned)) return ["dress"];

  const online = (planned.items ?? []).filter((it) => !it.wardrobeItemId);
  const cats = online.map((it) => canonicalItemCategory(it.category));
  const hasTop = cats.includes("top");
  const hasBottom = cats.includes("bottom");
  const hasOuterwear = cats.includes("outerwear");

  const required: string[] = [];
  if (hasTop) required.push("top");
  else if (hasOuterwear) required.push("outerwear");
  if (hasBottom) required.push("bottom");

  if (required.length >= 2) {
    // keep today's top/bottom (or outerwear+bottom) pair
  } else if (required.length === 1) {
    if (required[0] === "bottom") required.unshift("top");
  } else {
    required.push("top", "bottom");
  }

  const aestheticText = [
    brief,
    planned.label,
    planned.description,
    planned.productSearchQuery,
  ]
    .filter(Boolean)
    .join(" ");
  const needsOuter =
    hasOuterwear ||
    aestheticNeedsOuterwear(classifyFashionAesthetic(aestheticText));

  if (needsOuter && !required.includes("outerwear")) {
    required.unshift("outerwear");
  }

  if (required.includes("outerwear")) {
    return ["outerwear", "top", "bottom"].filter((c) => required.includes(c));
  }
  return required;
}

export function shouldSkipShoppingLayer(params: {
  hasSerpapi: boolean;
  category: string;
  look: PlannedLook;
  brief?: string;
}): boolean {
  if (params.hasSerpapi) return false;
  const slot = canonicalItemCategory(params.category);
  return !requiredPrimaryCategories(params.look, params.brief).includes(slot);
}

/** Online looks only enter the board when every required garment has a verified shop link. */
export function lookMeetsVerifiedProductGate(
  planned: PlannedLook,
  products: LookProduct[],
  brief?: string
): boolean {
  const shoppable = products.filter(isShoppableOnlineProduct);
  if (!shoppable.length) return false;

  const required = requiredPrimaryCategories(planned, brief);
  return required.every((cat) =>
    shoppable.some(
      (p) =>
        canonicalItemCategory(p.matchCategory) === cat &&
        productMatchesSlot(p.title ?? "", p.matchCategory, cat)
    )
  );
}

const BOARD_SHOP_FAIL =
  "We could not find verified products with shop links. Try again in a moment or widen your budget.";
const BOARD_PHOTOS_FAIL =
  "We found products but could not load their photos for the board. Try again in a moment.";

/** Dress, or top+bottom: enough to render. Outerwear is not required. */
function lookMeetsCoreProductGate(
  planned: PlannedLook,
  products: LookProduct[],
  brief?: string
): boolean {
  const shoppable = products.filter(isShoppableOnlineProduct);
  if (!shoppable.length) return false;

  if (isDressCentricLook(planned)) {
    return shoppable.some((p) =>
      productMatchesSlot(p.title ?? "", p.matchCategory, "dress")
    );
  }

  const required = requiredPrimaryCategories(planned, brief).filter(
    (cat) => cat !== "outerwear"
  );
  if (required.length === 0) {
    return lookHasAnyVerifiedProduct(planned, products);
  }

  return required.every((cat) =>
    shoppable.some(
      (p) =>
        canonicalItemCategory(p.matchCategory) === cat &&
        productMatchesSlot(p.title ?? "", p.matchCategory, cat)
    )
  );
}

/** Union of core-gate looks, with full-gate indices first (stable plan order). Empty iff none pass core. */
export function selectLooksForBoard(
  plan: PlannedLook[],
  productRows: Array<{ products: LookProduct[] }>,
  brief?: string
): number[] {
  const full = plan
    .map((_, i) => i)
    .filter((i) =>
      lookMeetsVerifiedProductGate(
        plan[i]!,
        productRows[i]?.products ?? [],
        brief
      )
    );
  const core = plan
    .map((_, i) => i)
    .filter((i) =>
      lookMeetsCoreProductGate(
        plan[i]!,
        productRows[i]?.products ?? [],
        brief
      )
    );
  const fullSet = new Set(full);
  return [...full, ...core.filter((i) => !fullSet.has(i))];
}

/**
 * Build up to `lookCount` outfits from products that already have a shop link
 * and a photo. A look is a dress, or a top and a bottom. Shoes are attached
 * when the pool has any, and then the shoe count caps the board. Outerwear
 * is attached when present and never required. Short pools return a shorter
 * board. No garment is invented.
 */
export function composeShoppableLooks(params: {
  lookCount: number;
  plan: PlannedLook[];
  products: LookProduct[];
}): { looks: PlannedLook[]; productsByLook: LookProduct[][] } {
  const usable = (slot: string) => {
    const seen = new Set<string>();
    const out: LookProduct[] = [];
    for (const p of params.products) {
      if (!isShoppableOnlineProduct(p) || !p.imageUrl || !p.productUrl) continue;
      if (canonicalItemCategory(p.matchCategory) !== slot) continue;
      if (!productMatchesSlot(p.title ?? "", p.matchCategory, slot)) continue;
      const key = p.productUrl;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  };

  const dresses = usable("dress");
  const tops = usable("top");
  const bottoms = usable("bottom");
  const shoes = usable("shoes");
  const outerwear = usable("outerwear");
  const separatePairs = Math.min(tops.length, bottoms.length);
  const shoeCap = shoes.length > 0 ? shoes.length : Number.POSITIVE_INFINITY;
  const capacity = Math.min(
    Math.max(0, params.lookCount),
    shoeCap,
    separatePairs + dresses.length
  );

  const productsByLook: LookProduct[][] = [];
  let topIndex = 0;
  let bottomIndex = 0;
  let dressIndex = 0;
  let shoeIndex = 0;
  let outerIndex = 0;
  const pushExtras = (row: LookProduct[]) => {
    if (shoes.length > 0) row.push(shoes[shoeIndex++]!);
    if (outerIndex < outerwear.length) row.push(outerwear[outerIndex++]!);
    productsByLook.push(row);
  };
  while (
    productsByLook.length < capacity &&
    topIndex < tops.length &&
    bottomIndex < bottoms.length
  ) {
    pushExtras([tops[topIndex++]!, bottoms[bottomIndex++]!]);
  }
  while (productsByLook.length < capacity && dressIndex < dresses.length) {
    pushExtras([dresses[dressIndex++]!]);
  }

  const looks = productsByLook.map((row, i) => {
    const base = params.plan[i];
    const brief = row
      .map((p) => p.title?.trim())
      .filter((title): title is string => Boolean(title))
      .join(", ");
    return {
      label: base?.label ?? `Look ${i + 1}`,
      tagline: base?.tagline,
      description: brief,
      productSearchQuery: brief,
      items: itemsFromBoardProducts(row),
    };
  });

  return { looks, productsByLook };
}

export function boardFailureReason(params: {
  totalVerified: number;
  keptLooks: number; // MUST be selectLooksForBoard length BEFORE prefetch/finalize
  refsAfterFinalize: number;
}): "shop" | "photos" | null {
  if (params.totalVerified === 0 || params.keptLooks === 0) return "shop";
  if (params.refsAfterFinalize === 0) return "photos";
  return null;
}

export function decideOnlineEmptyRefsOutcome(params: {
  boardPlan: PlannedLook[];
  looksProducts: Array<{ products: LookProduct[] }>;
  totalVerified: number;
  keptLooks: number;
  refsAfterFinalize: number;
}): { type: "complete-without-board" } | { type: "fail"; reason: "shop" | "photos" } {
  const hasShoppableLooks =
    params.boardPlan.length > 0 &&
    params.looksProducts.some((row) =>
      lookHasShoppableOnlineProduct(row.products)
    );
  if (params.refsAfterFinalize === 0 && hasShoppableLooks) {
    return { type: "complete-without-board" };
  }
  const reason = boardFailureReason({
    totalVerified: params.totalVerified,
    keptLooks: params.keptLooks,
    refsAfterFinalize: params.refsAfterFinalize,
  });
  return { type: "fail", reason: reason ?? "photos" };
}

type LookProductRow = { products: LookProduct[]; sessionId?: string };

type OnlineProductResolveContext = {
  style?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  personAnalysis?: PersonAnalysis | null;
  userId: string;
  generationJobId: string;
  retailerSites?: RetailerSiteOverride[];
  usedProducts: UsedProductTracker;
};

const FALLBACK_LABELS: Record<FashionAesthetic, string[]> = {
  old_money: [
    "Quiet Luxury",
    "Linen Heritage",
    "Tailored Ivory",
    "Navy Club",
    "Cream Layer",
    "Estate Walk",
  ],
  dressy: [
    "Office Party",
    "Cocktail Hour",
    "Evening Tailor",
    "Gala Night",
    "Reception",
    "After Dark",
  ],
  formal: [
    "Ceremony",
    "Board Formal",
    "Black Tie",
    "White Collar",
    "Evening Suit",
    "Classic Cut",
  ],
  casual: [
    "Classic Polo",
    "Smart Layer",
    "Office Shirt",
    "Weekend Knit",
    "Minimal Linen",
    "Urban Smart",
  ],
  smart: [
    "Classic Polo",
    "Smart Layer",
    "Office Shirt",
    "Weekend Knit",
    "Minimal Linen",
    "Urban Smart",
  ],
  street: [
    "Street Tee",
    "Hoodie Cargo",
    "Bomber Night",
    "Graphic Layer",
    "Cargo Weekend",
    "City Bomber",
  ],
  ethnic: [
    "Kurta Classic",
    "Nehru Evening",
    "Festive Layer",
    "Ivory Kurta",
    "Jacket Ethnic",
    "Occasion Wear",
  ],
};

/** Simple, highly searchable outfit templates when LLM-planned looks won't resolve. */
export function buildSimpleFallbackLook(
  index: number,
  style?: string,
  audience: string = "men",
  aesthetic: FashionAesthetic = "smart"
): PlannedLook {
  const items = fallbackLookItems(aesthetic, audience, index);
  const labels = FALLBACK_LABELS[aesthetic];
  const label = labels[index % labels.length] ?? `Look ${index + 1}`;
  const hero =
    items.find((it) => it.category === "outerwear")?.searchQuery ??
    items[0]?.searchQuery ??
    "outfit";
  return {
    label,
    tagline: "Easy to shop",
    description: `A reliable ${style?.trim() || "smart casual"} combination with broad retailer coverage.`,
    productSearchQuery: hero,
    items,
  };
}

async function fillMissingPrimarySlots(
  planned: PlannedLook,
  existing: LookProduct[],
  ctx: OnlineProductResolveContext & {
    region: "IN" | "US" | "UK";
    deadlineMs?: number;
    syncCrawlOnly?: boolean;
    syncCrawlFallback?: boolean;
    broadFirst?: boolean;
  }
): Promise<LookProduct[]> {
  const required = requiredPrimaryCategories(planned, ctx.style);
  const out = existing.filter(
    (p) =>
      isShoppableOnlineProduct(p) &&
      productMatchesSlot(
        p.title ?? "",
        p.matchCategory,
        canonicalItemCategory(p.matchCategory)
      )
  );

  for (const category of required) {
    if (ctx.deadlineMs != null && Date.now() > ctx.deadlineMs) break;

    const hasSlot = out.some(
      (p) =>
        canonicalItemCategory(p.matchCategory) === category &&
        productMatchesSlot(p.title ?? "", p.matchCategory, category)
    );
    if (hasSlot) continue;

    const item = planned.items?.find(
      (it) => canonicalItemCategory(it.category) === category
    );
    for (const query of slotSearchVariants({
      category,
      searchQuery: item?.searchQuery,
      description: item?.description,
      style: ctx.style,
      region: ctx.region,
      genderPresentation: ctx.personAnalysis?.genderPresentation,
      maxAttempts: MAX_SLOT_QUERY_ATTEMPTS,
      broadFirst: ctx.broadFirst,
    })) {
      if (ctx.deadlineMs != null && Date.now() > ctx.deadlineMs) break;
      const row = await productsForItem({
        look: planned,
        category,
        searchQuery: query,
        region: ctx.region,
        data: {
          style: ctx.style,
          budgetMin: undefined,
          budgetMax: ctx.budgetMax,
          personAnalysis: ctx.personAnalysis,
          userId: ctx.userId,
          generationJobId: ctx.generationJobId,
          syncCrawlFallback: ctx.syncCrawlFallback ?? false,
          syncCrawlOnly: ctx.syncCrawlOnly ?? false,
          retailerSites: ctx.retailerSites,
          relaxRetailerCap: true,
          broadFirst: ctx.broadFirst,
        },
        usedProducts: ctx.usedProducts,
      });
      if (
        row.product &&
        isShoppableOnlineProduct(row.product) &&
        productMatchesSlot(
          row.product.title ?? "",
          row.product.matchCategory,
          category
        )
      ) {
        out.push(row.product);
        break;
      }
    }
  }

  return out;
}

/** Soft board gate: at least one verified, category-plausible product. */
function lookHasAnyVerifiedProduct(
  planned: PlannedLook,
  products: LookProduct[]
): boolean {
  return products.some(
    (p) =>
      isShoppableOnlineProduct(p) &&
      productMatchesSlot(
        p.title ?? "",
        p.matchCategory,
        canonicalItemCategory(p.matchCategory ?? "garment")
      )
  );
}

async function ensureLookProducts(
  planned: PlannedLook,
  row: LookProductRow,
  ctx: OnlineProductResolveContext & { deadlineMs?: number }
): Promise<LookProductRow> {
  const region = locationToRegion(ctx.location);

  if (lookMeetsVerifiedProductGate(planned, row.products, ctx.style)) {
    return {
      products: row.products.filter(isShoppableOnlineProduct),
      sessionId: row.sessionId,
    };
  }

  if (ctx.deadlineMs != null && Date.now() > ctx.deadlineMs) {
    return {
      products: row.products.filter(isShoppableOnlineProduct),
      sessionId: row.sessionId,
    };
  }

  let products = row.products;
  let sessionId = row.sessionId;

  // Only sync-crawl when the look has nothing usable yet.
  if (!lookHasAnyVerifiedProduct(planned, products)) {
    const syncRetry = await productsForLook(planned, {
      style: ctx.style,
      location: ctx.location,
      budgetMin: ctx.budgetMin,
      budgetMax: ctx.budgetMax,
      personAnalysis: ctx.personAnalysis,
      userId: ctx.userId,
      generationJobId: ctx.generationJobId,
      usedProducts: ctx.usedProducts,
      syncCrawlFallback: true,
      syncCrawlOnly: true,
      retailerSites: ctx.retailerSites,
    }).catch(() => ({ products: [] as LookProduct[], sessionId: undefined }));

    if (syncRetry.products.length) {
      products = syncRetry.products;
      sessionId = syncRetry.sessionId ?? sessionId;
    }
  }

  if (
    !lookMeetsVerifiedProductGate(planned, products, ctx.style) &&
    (ctx.deadlineMs == null || Date.now() <= ctx.deadlineMs)
  ) {
    products = await fillMissingPrimarySlots(planned, products, {
      ...ctx,
      region,
      deadlineMs: ctx.deadlineMs,
      syncCrawlOnly: true,
      syncCrawlFallback: true,
    });
  }

  return {
    products: products.filter(isShoppableOnlineProduct),
    sessionId,
  };
}

/**
 * Heuristic: returns true when a string is too generic to display as a
 * garment description (e.g. "TOP", "OTHER", "garment"). Used to decide
 * whether to keep an LLM-supplied description or fall back to the rich
 * vision-generated one.
 */
function isUselessDescription(value: string | undefined | null): boolean {
  if (!value) return true;
  const s = value.trim().toLowerCase();
  if (!s || s.length < 4) return true;
  if (/^(top|bottom|dress|outerwear|shoes?|accessory|garment|other|footwear)$/.test(s)) {
    return true;
  }
  // No spaces and too short → almost certainly an enum echo
  if (!/\s/.test(s) && s.length < 8) return true;
  return false;
}

/**
 * Extracts the best available human-readable description for a wardrobe
 * row. Preference order:
 *   1. styleLabels.description  (written by GPT-4o describeGarment)
 *   2. styleLabels.caption      (Azure Vision fallback, when configured)
 *   3. colors + tags + category (assembled from any structured metadata)
 *   4. "your <category>"         (last-resort fallback)
 */
function readWardrobeDescription(it: {
  category: string;
  tags: unknown;
  colors: unknown;
  styleLabels: unknown;
}): string {
  const labels =
    it.styleLabels && typeof it.styleLabels === "object"
      ? (it.styleLabels as Record<string, unknown>)
      : null;
  const description =
    typeof labels?.description === "string" ? labels.description.trim() : "";
  if (description) return description;
  const caption =
    typeof labels?.caption === "string" ? labels.caption.trim() : "";
  if (caption) return caption;
  const colors = Array.isArray(it.colors) ? (it.colors as string[]) : [];
  const tags = Array.isArray(it.tags) ? (it.tags as string[]) : [];
  const canonical = canonicalItemCategory(it.category);
  const composed = [...colors.slice(0, 2), ...tags.slice(0, 2), canonical]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .map((s) => s.toLowerCase())
    .join(" ");
  if (composed.trim().length >= 6) return composed;
  return `your ${canonical}`;
}

function listingLooksShoppable(p: Product): boolean {
  const norm = productToNormalized(p);
  if (!norm.productUrl || !norm.imageUrl) return false;
  if (norm.source === "demo") return false;
  if (/example\.com/i.test(norm.productUrl)) return false;
  if (norm.availability === "out_of_stock") return false;
  return true;
}

function productUrlOf(p: Product): string {
  return p.canonicalUrl ?? p.url;
}

type SlotDiscoverData = {
  style?: string;
  budgetMin?: number;
  budgetMax?: number;
  personAnalysis?: PersonAnalysis | null;
  userId?: string;
  generationJobId?: string;
  syncCrawlFallback?: boolean;
  syncCrawlOnly?: boolean;
  retailerSites?: RetailerSiteOverride[];
  relaxRetailerCap?: boolean;
  isHero?: boolean;
  /** Online path: search a broad slot query before the planned garment name. */
  broadFirst?: boolean;
};

async function lookProductFrom(
  p: Product,
  category: string,
  sessionId?: string
): Promise<LookProduct> {
  const norm = productToNormalized(p);
  const canonicalOk = norm.canonicalUrl
    ? usableMerchantUrl(norm.canonicalUrl)
    : null;
  const productOk = usableMerchantUrl(norm.productUrl);
  // Prefer a usable canonical PDP. Never fall back to a rewritten dead URL.
  const productUrl = canonicalOk ?? productOk ?? "";
  const canonicalUrl = canonicalOk ?? productOk ?? undefined;
  const row = productUrl
    ? await cacheProduct({
        ...norm,
        productUrl,
        canonicalUrl: canonicalUrl ?? productUrl,
      })
    : null;
  const verified = p.pdpVerified === true || norm.verified === true;
  return {
    title: norm.title,
    productUrl,
    source: norm.source,
    productCacheId: row?.id,
    price: norm.price,
    currency: norm.currency,
    imageUrl: norm.imageUrl,
    storeName: norm.storeName,
    verified,
    canonicalUrl,
    availability: norm.availability,
    matchCategory: category,
    matchConfidence: norm.matchConfidence,
    sessionId,
  };
}

/** Bound serial Playwright PDP checks per slot so one slot can't stall a look. */
const MAX_PDP_CHECKS_PER_SLOT = 2;

async function pickClaimAndVerify(args: {
  candidates: Product[];
  category: string;
  region: "IN" | "US" | "UK";
  usedProducts: UsedProductTracker;
  relaxRetailerCap?: boolean;
}): Promise<Product | null> {
  const { candidates, category, region, usedProducts } = args;
  const crawlerReady =
    !!process.env.PRODUCT_CRAWLER_URL && !isCrawlerCircuitOpen();
  let pdpChecks = 0;

  // Pass 1 honours the per-retailer diversity cap. Pass 2 relaxes it — a
  // verified link from a repeated store always beats an empty slot.
  const capPasses =
    args.relaxRetailerCap === true ? [true] : [false, true];

  for (const relaxCap of capPasses) {
    const relax = { relaxRetailerCap: relaxCap };
    const eligible = candidates.filter((p) =>
      usedProducts.isAvailable(productUrlOf(p), p.title, relax)
    );
    const ordered = eligible;

    for (const cand of ordered) {
      const url = productUrlOf(cand);
      if (!isUsableShopUrl(url)) continue;
      if (!usedProducts.tryClaim(url, cand.title, relax)) continue;

      const trusted = isRealProduct(productToNormalized(cand));
      const verify =
        crawlerReady &&
        pdpChecks < MAX_PDP_CHECKS_PER_SLOT &&
        needsPdpVerification(cand);

      if (!verify) {
        if (trusted) return cand;
        usedProducts.release(url, cand.title);
        continue;
      }

      pdpChecks += 1;
      try {
        const resolved = await resolveProductUrl({ url, region, category });
        if (
          resolved &&
          resolved.availability !== "out_of_stock" &&
          resolved.image &&
          resolved.url
        ) {
          const nextUrl = productUrlOf(resolved);
          if (nextUrl !== url) {
            usedProducts.release(url, cand.title);
            usedProducts.burn(url);
            if (!usedProducts.tryClaim(nextUrl, resolved.title, relax)) {
              continue;
            }
          }
          return {
            ...resolved,
            verified: true,
            pdpVerified: true,
            lastCrawledAt: new Date().toISOString(),
          };
        }
      } catch (e) {
        console.warn("PDP verify errored:", e);
        // Transport failure (timeout / crawler busy) — a once-verified
        // listing is still the best answer we have. Keep it.
        if (trusted) return cand;
      }

      // The crawler could not re-validate the page. Bot-hardened PDPs fail
      // here all the time despite being live, so once-verified listings are
      // kept; only never-verified snippets are burned.
      if (trusted) return cand;
      usedProducts.release(url, cand.title);
      usedProducts.burn(url);
    }
  }

  return null;
}

/**
 * Resolve products for a single item slot (e.g. blazer for look 1). Pulls
 * candidates from the discovery pipeline (cache → index → shopping → crawl)
 * and picks at most one product that survives uniqueness + buyability checks.
 */
async function discoverSlotCandidates(args: {
  look: PlannedLook;
  category: string;
  searchQuery: string;
  region: "IN" | "US" | "UK";
  usedProducts: UsedProductTracker;
  data: SlotDiscoverData;
}): Promise<{ candidates: Product[]; sessionId?: string }> {
  const { look, category, searchQuery, region, data, usedProducts } = args;
  const queryText = slotSearchQuery(searchQuery, category, data.style);
  const item = look.items?.find(
    (it) => canonicalItemCategory(it.category) === category
  );

  const variants = data.broadFirst
    ? slotSearchVariants({
        category,
        searchQuery: queryText,
        description: item?.description,
        style: data.style,
        region,
        genderPresentation: data.personAnalysis?.genderPresentation,
        maxAttempts: MAX_SLOT_QUERY_ATTEMPTS,
        broadFirst: true,
      })
    : data.isHero && !data.syncCrawlOnly
      ? heroSearchVariants({
          searchQuery: queryText,
          category,
          style: data.style,
          lookLabel: look.label,
          lookDescription: look.description,
          lookTagline: look.tagline,
          itemDescription: item?.description,
          budgetMax: data.budgetMax,
        }).slice(0, 1)
      : [queryText];

  const baseQuery = (q: string): ProductQuery => ({
    query: q,
    category,
    region,
    budgetMin: undefined,
    budgetMax: data.budgetMax,
    aestheticKeywords: look.tagline
      ? ([look.tagline, look.label].filter(Boolean) as string[])
      : undefined,
    retailerSites: data.retailerSites,
  });

  const rankingFor = (q: ProductQuery) => ({
    query: q,
    personAnalysis: data.personAnalysis,
    plannedLook: look,
  });

  let products: Product[] = [];
  let sessionId: string | undefined;

  const skipShopping = shouldSkipShoppingLayer({
    hasSerpapi: Boolean(process.env.SERPAPI_KEY),
    category,
    look,
    brief: data.style,
  });

  const runDiscover = async (query: ProductQuery, opts: {
    syncCrawlFallback?: boolean;
    syncCrawlOnly?: boolean;
  }) =>
    discoverProducts({
      query,
      userId: data.userId,
      generationJobId: data.generationJobId,
      rankingContext: rankingFor(query),
      allowAsyncCrawl: false,
      syncCrawlFallback: opts.syncCrawlFallback ?? false,
      syncCrawlOnly: opts.syncCrawlOnly ?? false,
      skipShoppingLayer: skipShopping,
    });

  const slotCandidates = (list: Product[]) =>
    list.filter((p) => {
      if (!listingLooksShoppable(p)) return false;
      if (
        !productMatchesSlot(p.title, p.category, category, {
          genderPresentation: data.personAnalysis?.genderPresentation,
          requestedText: searchQuery,
        })
      ) {
        return false;
      }
      return usedProducts.isAvailable(productUrlOf(p), p.title, {
        relaxRetailerCap: true,
      });
    });

  if (data.broadFirst) {
    for (const q of variants) {
      const discovered = await runDiscover(baseQuery(q), {
        syncCrawlFallback: data.syncCrawlFallback ?? false,
        syncCrawlOnly: data.syncCrawlOnly ?? false,
      });
      products = discovered.products;
      sessionId = discovered.sessionId ?? sessionId;
      const matched = slotCandidates(products);
      if (matched.length) return { candidates: matched, sessionId };
    }
  } else if (variants.length > 1) {
    const batch = await discoverProductsBatch(
      variants.map((q, i) => ({
        key: `${category}:${i}`,
        query: baseQuery(q),
        rankingContext: rankingFor(baseQuery(q)),
      })),
      {
        userId: data.userId,
        generationJobId: data.generationJobId,
        syncCrawlFallback: data.syncCrawlFallback,
        allowAsyncCrawl: false,
        skipShoppingLayer: skipShopping,
      }
    );
    products = dedupeProducts(batch.flatMap((b) => b.products));
    sessionId = batch.find((b) => b.sessionId)?.sessionId;
    if (products.length) {
      products = await rankProductList(products, rankingFor(baseQuery(queryText)));
    }
  } else {
    const discovered = await runDiscover(baseQuery(queryText), {
      syncCrawlFallback: data.syncCrawlFallback ?? false,
      syncCrawlOnly: data.syncCrawlOnly ?? false,
    });
    products = discovered.products;
    sessionId = discovered.sessionId;
  }

  if (
    !products.some(
      (p) =>
        listingLooksShoppable(p) &&
        productMatchesSlot(p.title, p.category, category, {
          genderPresentation: data.personAnalysis?.genderPresentation,
          requestedText: searchQuery,
        })
    ) &&
    !data.syncCrawlOnly &&
    data.syncCrawlFallback
  ) {
    const retry = await runDiscover(baseQuery(queryText), {
      syncCrawlFallback: true,
      syncCrawlOnly: true,
    });
    products = dedupeProducts([...products, ...retry.products]);
    sessionId = retry.sessionId ?? sessionId;
  }

  // Retailer caps are enforced (softly, two-pass) at claim time. Here only
  // URL/title uniqueness matters — otherwise one dominant store's pool would
  // starve the slot before pickClaimAndVerify even runs.
  const candidates = products.filter((p) => {
    if (!listingLooksShoppable(p)) return false;
    if (
      !productMatchesSlot(p.title, p.category, category, {
        genderPresentation: data.personAnalysis?.genderPresentation,
        requestedText: searchQuery,
      })
    ) {
      return false;
    }
    return usedProducts.isAvailable(productUrlOf(p), p.title, {
      relaxRetailerCap: true,
    });
  });

  return { candidates, sessionId };
}

async function productsForItem(args: {
  look: PlannedLook;
  category: string;
  searchQuery: string;
  region: "IN" | "US" | "UK";
  usedProducts: UsedProductTracker;
  data: SlotDiscoverData;
}): Promise<{ product: LookProduct | null; sessionId?: string }> {
  const discovered = await discoverSlotCandidates(args);
  const picked = await pickClaimAndVerify({
    candidates: discovered.candidates,
    category: args.category,
    region: args.region,
    usedProducts: args.usedProducts,
    relaxRetailerCap: args.data.relaxRetailerCap,
  });
  if (!picked) {
    return { product: null, sessionId: discovered.sessionId };
  }
  return {
    product: await lookProductFrom(picked, args.category, discovered.sessionId),
    sessionId: discovered.sessionId,
  };
}

/**
 * Unique garment slots to shop for a look. Dress-centric looks that omitted a
 * dress item get a dress slot unshifted before the per-look cap.
 */
export function shoppingSlotsForLook(
  look: PlannedLook,
  brief?: string
): Array<{ category: string; searchQuery: string }> {
  const baseItems = look.items?.length
    ? look.items.map((it) => ({
        category: canonicalItemCategory(it.category),
        searchQuery: it.searchQuery ?? `${it.category} ${it.description}`.trim(),
      }))
    : [
        { category: "top", searchQuery: `${look.label} top` },
        { category: "bottom", searchQuery: `${look.label} bottom` },
        { category: "shoes", searchQuery: `${look.label} shoes` },
      ];

  const seenCategory = new Set<string>();
  const unique = baseItems
    .filter((s) => {
      if (seenCategory.has(s.category)) return false;
      seenCategory.add(s.category);
      return !!s.searchQuery;
    })
    .sort(
      (a, b) =>
        productSlotPriority(a.category) - productSlotPriority(b.category)
    );

  if (isDressCentricLook(look) && !unique.some((s) => s.category === "dress")) {
    unique.unshift({
      category: "dress",
      searchQuery:
        look.productSearchQuery?.trim() || look.description?.trim() || "dress",
    });
  }

  if (
    requiredPrimaryCategories(look, brief).includes("outerwear") &&
    !unique.some((s) => s.category === "outerwear")
  ) {
    unique.unshift({
      category: "outerwear",
      searchQuery:
        genericSlotQueries("outerwear", brief)[0] ?? "tailored blazer",
    });
  }

  return unique.slice(0, maxSlotsForLook());
}

/**
 * Resolve verified products for every item in a look.
 *
 * Hero slots fan out 2–3 Google-style queries. All slots keep a ranked
 * candidate pool; a cheap combo rerank picks a coherent outfit, then each
 * winner is claimed and PDP-verified so links are buyable in-region.
 */
async function productsForLook(
  look: PlannedLook,
  data: {
    style?: string;
    location?: string;
    budgetMin?: number;
    budgetMax?: number;
    personAnalysis?: PersonAnalysis | null;
    userId?: string;
    generationJobId?: string;
    usedProducts: UsedProductTracker;
    syncCrawlFallback?: boolean;
    syncCrawlOnly?: boolean;
    retailerSites?: RetailerSiteOverride[];
    broadFirst?: boolean;
  }
): Promise<{ products: LookProduct[]; sessionId?: string }> {
  const region = locationToRegion(data.location);
  const itemData: SlotDiscoverData = {
    style: data.style,
    budgetMin: data.budgetMin,
    budgetMax: data.budgetMax,
    personAnalysis: data.personAnalysis,
    userId: data.userId,
    generationJobId: data.generationJobId,
    syncCrawlFallback: data.syncCrawlFallback ?? false,
    syncCrawlOnly: data.syncCrawlOnly ?? false,
    retailerSites: data.retailerSites,
    broadFirst: data.broadFirst,
  };

  const slots = shoppingSlotsForLook(look, data.style);
  const dressCentric = isDressCentricLook(look);
  const dressSlot = slots.find((s) => s.category === "dress");
  const primarySlot = dressCentric ? dressSlot ?? slots[0] : slots[0];
  if (!primarySlot) {
    return { products: [], sessionId: undefined };
  }

  const primaryQuery =
    look.productSearchQuery?.trim() ||
    primarySlot.searchQuery ||
    `${look.label} ${primarySlot.category}`;

  const resolveCandidates = (s: {
    category: string;
    searchQuery: string;
    isHero?: boolean;
  }) =>
    discoverSlotCandidates({
      look,
      category: s.category,
      searchQuery: s.searchQuery,
      region,
      data: { ...itemData, isHero: s.isHero },
      usedProducts: data.usedProducts,
    }).catch((err) => {
      console.warn(
        `discoverSlotCandidates failed (${s.category} / ${s.searchQuery}):`,
        err
      );
      return { candidates: [] as Product[], sessionId: undefined };
    });

  // Slow path: only the primary garment so we don't saturate Playwright.
  if (!fastShoppingConfigured() && !data.syncCrawlOnly) {
    const primaryRes = await productsForItem({
      look,
      category: primarySlot.category,
      searchQuery: primaryQuery,
      region,
      data: { ...itemData, isHero: true },
      usedProducts: data.usedProducts,
    });
    if (!primaryRes.product || !isShoppableOnlineProduct(primaryRes.product)) {
      return { products: [], sessionId: primaryRes.sessionId };
    }
    return { products: [primaryRes.product], sessionId: primaryRes.sessionId };
  }

  const slotJobs = slots.map((s) =>
    s === primarySlot
      ? {
          category: primarySlot.category,
          searchQuery: primaryQuery,
          isHero: true,
        }
      : { category: s.category, searchQuery: s.searchQuery, isHero: false }
  );

  const resolved = await mapWithConcurrency(
    slotJobs,
    slotConcurrency(),
    (s) => resolveCandidates(s)
  );

  const comboPicks = rerankOutfitCombos(
    resolved.map((r, i) => ({
      category: slotJobs[i]!.category,
      candidates: r.candidates.slice(0, 4),
    })),
    {
      budgetMin: data.budgetMin,
      budgetMax: data.budgetMax,
      bestColors: data.personAnalysis?.bestColors,
      query: look.productSearchQuery ?? look.label,
      style: data.style,
    }
  );

  const products: LookProduct[] = [];
  let sessionId: string | undefined;
  for (let i = 0; i < slotJobs.length; i++) {
    const slot = slotJobs[i]!;
    const pool = resolved[i]!;
    if (pool.sessionId && !sessionId) sessionId = pool.sessionId;
    const winner = comboPicks[i];
    const ordered = winner
      ? [
          winner,
          ...pool.candidates.filter(
            (c) => productUrlOf(c) !== productUrlOf(winner)
          ),
        ]
      : pool.candidates;
    const picked = await pickClaimAndVerify({
      candidates: ordered,
      category: slot.category,
      region,
      usedProducts: data.usedProducts,
    });
    if (!picked) continue;
    const lookProduct = await lookProductFrom(
      picked,
      slot.category,
      pool.sessionId
    );
    if (isShoppableOnlineProduct(lookProduct)) {
      products.push(lookProduct);
    }
  }

  return { products, sessionId };
}

export async function processGenerationJob(
  payload: QueueJobPayload
): Promise<void> {
  const { jobId, userId, input } = payload;

  if (payload.type !== "GENERATION") {
    await failJob(jobId, "Unsupported job type");
    return;
  }

  const parsed = generateJobSchema.safeParse(input);
  if (!parsed.success) {
    await failJob(jobId, "Invalid generation payload");
    return;
  }

  const data = parsed.data;

  const jobRow = await prisma.generationJob.findFirst({
    where: { id: jobId, userId, jobType: JobType.GENERATION },
  });
  if (!jobRow) {
    return;
  }

  const renderQuality = resolveRenderQuality(data);
  const providerMeta: ProviderMeta = {};
  let productHeartbeat: ReturnType<typeof setInterval> | null = null;

  try {
    const existingPayload = jobRow.payload as {
      billingReservationId?: string;
    } | null;
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.PROCESSING,
        progress: 8,
        payload: {
          ...(data as object),
          cancelled: false,
          billingReservationId: existingPayload?.billingReservationId,
        },
      },
    });

    if (data.userPhotoUrl) {
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { progress: 15 },
      });
    }

    // For the wardrobe path we need the FULL closet (Mix can fill non-locked
    // categories from anything the user owns) plus a Set of selected ids that
    // become hard anchors. For online we skip the DB hit.
    const isWardrobePath = data.path === "wardrobe";
    const wardrobeMode = isWardrobePath
      ? (data.wardrobeMode ?? "mix")
      : undefined;

    const personAnalysisPromise: Promise<PersonAnalysis | null> =
      data.userPhotoUrl
        ? analyzePersonPhoto(data.userPhotoUrl)
        : Promise.resolve(null);

    const wardrobeRowsPromise = isWardrobePath
      ? prisma.wardrobeItem.findMany({
          where: { wardrobe: { userId } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([] as Awaited<
          ReturnType<typeof prisma.wardrobeItem.findMany>
        >);

    const [personAnalysis, wardrobeRowsAll] = await Promise.all([
      personAnalysisPromise,
      wardrobeRowsPromise,
    ]);

    const selectedIdSet = new Set<string>(
      isWardrobePath ? (data.wardrobeItemIds ?? []) : []
    );

    // ──────────────────────────────────────────────────────────────────
    // Lazy description backfill: for any wardrobe item that doesn't yet
    // have a GPT-4o description (legacy uploads, manual category overrides,
    // or rows where vision was unavailable), generate one now in parallel
    // and persist it back so the next run is instant.
    //
    // We only backfill items that will actually feed the LLM — for Pair
    // mode that's just the user's selections; for Mix mode it's the full
    // closet. This caps the per-job cost at ~one round-trip even with a
    // large wardrobe.
    // ──────────────────────────────────────────────────────────────────
    if (isWardrobePath) {
      const candidates = wardrobeRowsAll.filter((it) => {
        const labels =
          it.styleLabels && typeof it.styleLabels === "object"
            ? (it.styleLabels as Record<string, unknown>)
            : null;
        const hasDescription =
          typeof labels?.description === "string" &&
          (labels.description as string).trim().length > 0;
        if (hasDescription) return false;
        if (!it.imageUrl) return false;
        if (wardrobeMode === "pair") return selectedIdSet.has(it.id);
        return true;
      });
      if (candidates.length > 0) {
        const results = await Promise.allSettled(
          candidates.map((it) => describeGarment(it.imageUrl as string))
        );
        await Promise.allSettled(
          results.map(async (r, i) => {
            if (r.status !== "fulfilled" || !r.value) return;
            const target = candidates[i];
            const existing =
              target.styleLabels && typeof target.styleLabels === "object"
                ? (target.styleLabels as Record<string, unknown>)
                : {};
            const merged = { ...existing, description: r.value };
            target.styleLabels = merged as typeof target.styleLabels;
            try {
              await prisma.wardrobeItem.update({
                where: { id: target.id },
                data: { styleLabels: merged },
              });
            } catch (e) {
              console.warn("failed to persist wardrobe description", e);
            }
          })
        );
      }
    }

    // Build a lookup keyed by id, plus a resolved read URL per item. Read
    // URLs are computed once here and reused for both the prompt context
    // (so the LLM knows what the items look like via description) and the
    // image-gen reference list later on.
    const wardrobeById = new Map<
      string,
      {
        id: string;
        category: string;
        canonicalCategory: string;
        description: string;
        readUrl: string | null;
      }
    >();
    for (const it of wardrobeRowsAll) {
      const description = readWardrobeDescription(it);
      wardrobeById.set(it.id, {
        id: it.id,
        category: it.category,
        canonicalCategory: canonicalItemCategory(it.category),
        description,
        readUrl: resolveWardrobeItemReadUrl(it, AZURE_WARDROBE_CONTAINER),
      });
    }

    const wardrobeSummary: string | undefined = isWardrobePath
      ? wardrobeRowsAll
          .filter((it) => selectedIdSet.has(it.id))
          .map((it) => readWardrobeDescription(it))
          .join("; ") || undefined
      : undefined;

    // Build the wardrobeContext that gets passed to the LLM. Mix mode
    // exposes the full closet as `allowedItems`; Pair mode exposes only
    // selected anchors. `lockedByCategory` enforces the per-category rule
    // ("if 1 selected -> must use it; if N selected -> rotate them").
    let wardrobeContext: WardrobeContext | undefined;
    if (isWardrobePath) {
      const universe =
        wardrobeMode === "pair"
          ? wardrobeRowsAll.filter((it) => selectedIdSet.has(it.id))
          : wardrobeRowsAll;
      const allowedItems = universe.map((it) => ({
        id: it.id,
        category: canonicalItemCategory(it.category),
        description:
          wardrobeById.get(it.id)?.description ?? readWardrobeDescription(it),
      }));
      const lockedByCategory: Record<string, string[]> = {};
      for (const it of wardrobeRowsAll) {
        if (!selectedIdSet.has(it.id)) continue;
        const cat = canonicalItemCategory(it.category);
        (lockedByCategory[cat] ??= []).push(it.id);
      }
      wardrobeContext = {
        mode: wardrobeMode!,
        allowedItems,
        lockedByCategory,
      };
    }

    const current = await prisma.generationJob.findUnique({
      where: { id: jobId },
    });
    if (isJobCancelled(current?.payload)) {
      await failJob(jobId, "Cancelled");
      return;
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { progress: 28 },
    });

    const lookCount = data.lookCount ?? 6;
    const shoppingBrief = joinShoppingStyle({
      styleType: data.styleType,
      occasion: data.occasion,
      style: data.style,
    });
    const { plan, gptRetailerSites } = await planLooks({
      path: data.path,
      styleType: data.styleType,
      occasion: data.occasion,
      location: data.location,
      budgetMin: data.budgetMin,
      budgetMax: data.budgetMax,
      style: data.style,
      personAnalysis,
      wardrobeSummary,
      wardrobeContext,
      lookCount,
    });

    const region = locationToRegion(data.location);
    const retailerSites =
      data.path === "online"
        ? await resolveRetailerSites({
            region,
            styleType: data.styleType,
            occasion: data.occasion,
            gptSites: gptRetailerSites,
          })
        : [];

    if (retailerSites.length) {
      console.info(
        `[generation] dynamic retailer sites: ${retailerSites.length} (${retailerSites
          .slice(0, 5)
          .map((s) => s.domain)
          .join(", ")}${retailerSites.length > 5 ? "…" : ""})`
      );
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { progress: 42 },
    });

    // Keep updatedAt fresh during long product crawls so the stale-job guard
    // does not kill in-flight work. Touch the row every 20s for the whole phase.
    if (data.path === "online") {
      let hbProgress = 43;
      productHeartbeat = setInterval(() => {
        const next = Math.min(hbProgress + 1, 54);
        hbProgress = next;
        void prisma.generationJob
          .update({
            where: { id: jobId },
            data: {
              progress: next,
              // Force @updatedAt even when progress is already capped at 54.
              updatedAt: new Date(),
            },
          })
          .catch(() => undefined);
      }, 20_000);
      productHeartbeat.unref?.();
    }

    if (data.path === "online") {
      resetCrawlerCircuit();
    }

    // ──────────────────────────────────────────────────────────────────
    // Step 1: resolve products for all 6 looks BEFORE image gen so their
    // thumbnails can be passed as multi-image references.
    //
    // Wardrobe modes get a different pipeline:
    //   - Mix:  every slot must come from the closet, no online search at
    //           all. Maps each look's items[i].wardrobeItemId to a closet
    //           item and emits LookProduct{ kind: "wardrobe" }.
    //   - Pair: closet anchors fill the slots the LLM tagged with
    //           wardrobeItemId; the rest go through the regular online
    //           productsForLook pipeline so the user gets buyable links.
    //   - Online: existing behaviour, no closet involvement.
    // ──────────────────────────────────────────────────────────────────

    const buildWardrobeProductsForLook = (
      planned: PlannedLook
    ): LookProduct[] => {
      const out: LookProduct[] = [];
      for (const item of planned.items ?? []) {
        const wid = item.wardrobeItemId;
        if (!wid) continue;
        const row = wardrobeById.get(wid);
        if (!row) continue;
        if (!row.readUrl) continue;
        // The LLM sometimes echoes the canonical category ("TOP") into the
        // description — treat those as garbage and prefer the vision-
        // generated description from the wardrobe row instead.
        const llmDesc = item.description?.trim();
        const title = isUselessDescription(llmDesc) ? row.description : llmDesc!;
        out.push({
          title,
          productUrl: row.readUrl,
          source: "wardrobe",
          price: undefined,
          currency: undefined,
          imageUrl: row.readUrl,
          storeName: undefined,
          verified: true,
          canonicalUrl: row.readUrl,
          availability: "in_stock",
          matchCategory: canonicalItemCategory(item.category),
          matchConfidence: 1,
          kind: "wardrobe",
          wardrobeItemId: row.id,
        });
      }
      return out;
    };

    const usedProducts = new UsedProductTracker();
    let productResults: Array<{
      products: LookProduct[];
      sessionId?: string;
    }>;

    if (isWardrobePath && wardrobeMode === "mix") {
      // Mix: closet only. No HTTP calls beyond the initial wardrobe load.
      productResults = plan.map((planned) => ({
        products: buildWardrobeProductsForLook(planned),
        sessionId: undefined,
      }));
    } else if (isWardrobePath && wardrobeMode === "pair") {
      // Pair: keep anchors as wardrobe products, run online discovery only
      // for the slots the LLM left without a wardrobeItemId.
      productResults = await mapWithConcurrency(
        plan,
        lookConcurrency(),
        async (planned) => {
          const wardrobeProducts = buildWardrobeProductsForLook(planned);
          const onlineSlotItems = (planned.items ?? []).filter(
            (it) => !it.wardrobeItemId
          );
          // Skip productsForLook entirely if there are no online slots —
          // saves a redundant crawler call when the user anchored every
          // category.
          if (!onlineSlotItems.length) {
            return { products: wardrobeProducts, sessionId: undefined };
          }
          const filteredLook: PlannedLook = {
            ...planned,
            items: onlineSlotItems,
          };
          const online = await productsForLook(filteredLook, {
            style: shoppingBrief,
            location: data.location,
            budgetMin: data.budgetMin,
            budgetMax: data.budgetMax,
            personAnalysis,
            userId,
            generationJobId: jobId,
            usedProducts,
            retailerSites,
          }).catch((err) => {
            console.warn("productsForLook (pair) failed:", err);
            return { products: [] as LookProduct[], sessionId: undefined };
          });
          const onlineWithKind: LookProduct[] = online.products.map((p) => ({
            ...p,
            kind: p.kind ?? "online",
          }));
          return {
            products: [...wardrobeProducts, ...onlineWithKind],
            sessionId: online.sessionId,
          };
        }
      );
    } else {
      // Default online flow (path === "online" or wardrobe-without-mode).
      productResults = await mapWithConcurrency(
        plan,
        lookConcurrency(),
        async (planned) => {
          const resolved = await productsForLook(planned, {
            style: shoppingBrief,
            location: data.location,
            budgetMin: data.budgetMin,
            budgetMax: data.budgetMax,
            personAnalysis,
            userId,
            generationJobId: jobId,
            usedProducts,
            retailerSites,
            broadFirst: data.path === "online",
          }).catch((err) => {
            console.warn("productsForLook failed:", err);
            return { products: [] as LookProduct[], sessionId: undefined };
          });
          const products = await fillMissingPrimarySlots(planned, resolved.products, {
            style: shoppingBrief,
            location: data.location,
            budgetMin: data.budgetMin,
            budgetMax: data.budgetMax,
            personAnalysis,
            userId,
            generationJobId: jobId,
            usedProducts,
            retailerSites,
            region,
            syncCrawlOnly: false,
            syncCrawlFallback: false,
            broadFirst: data.path === "online",
          });
          return { products, sessionId: resolved.sessionId };
        }
      );
    }

    const productSearchSessionIds: string[] = [];
    for (const r of productResults) {
      if (r.sessionId) productSearchSessionIds.push(r.sessionId);
    }

    // Online: render looks that already have shoppable products. Skip the
    // 90s Playwright recovery — that is what pushed generation past 5 minutes.
    let boardPlan = plan;
    let boardProductResults = productResults;
    let onlineTotalVerified = 0;
    let onlineKeptLooks = 0;
    if (data.path === "online") {
      const totalVerified = productResults.reduce(
        (sum, r) => sum + r.products.filter(isShoppableOnlineProduct).length,
        0
      );
      onlineTotalVerified = totalVerified;

      if (
        totalVerified === 0 &&
        boardFailureReason({
          totalVerified,
          keptLooks: 0,
          refsAfterFinalize: 0,
        }) === "shop"
      ) {
        if (productHeartbeat) clearInterval(productHeartbeat);
        await failJob(jobId, BOARD_SHOP_FAIL);
        return;
      }

      const composed = composeShoppableLooks({
        lookCount,
        plan,
        products: productResults.flatMap((row) => row.products),
      });
      onlineKeptLooks = composed.looks.length;

      if (composed.looks.length === 0) {
        if (productHeartbeat) clearInterval(productHeartbeat);
        await failJob(jobId, BOARD_SHOP_FAIL);
        return;
      }

      const sessionId = productResults.find((row) => row.sessionId)?.sessionId;
      boardPlan = composed.looks;
      boardProductResults = composed.productsByLook.map((products) => ({
        products,
        sessionId,
      }));

      if (composed.looks.length < lookCount) {
        providerMeta.degraded = true;
        providerMeta.failures = [
          ...(providerMeta.failures ?? []),
          {
            system: "products",
            provider: "compose",
            message: `Showing ${composed.looks.length} of ${lookCount} looks. Only that many could be built from products with a shop link and a photo.`,
          },
        ];
      }
    }

    // Build the image-edit ingredient list: user photo is Image 1, then each
    // unique real product becomes Image 2..N. Prefetch the thumbnails first so
    // Image N in the prompt is exactly the file uploaded — a failed fetch used
    // to collapse the array and pair the wrong shoe with the wrong link.
    const built = buildProductImageRefs(boardProductResults, {
      includeWardrobe: true,
    });
    const uploadedUrls = await prefetchProductImageUrls(
      built.productImageUrls,
      MAX_PRODUCT_IMAGE_REFS
    );
    const aligned = finalizeBoardImageRefs({
      looks: boardPlan,
      looksProducts: boardProductResults,
      refs: built.productImageRefs,
      uploadedUrls,
    });
    boardPlan = aligned.looks;
    boardProductResults = aligned.looksProducts;
    const productImageRefs = aligned.refs;
    const productImageUrls = aligned.productImageUrls;

    if (data.path === "online" && productImageRefs.length === 0) {
      const outcome = decideOnlineEmptyRefsOutcome({
        boardPlan,
        looksProducts: boardProductResults,
        totalVerified: onlineTotalVerified,
        keptLooks: onlineKeptLooks,
        refsAfterFinalize: productImageRefs.length,
      });
      if (outcome.type === "complete-without-board") {
        providerMeta.degraded = true;
        providerMeta.failures = [
          ...(providerMeta.failures ?? []),
          {
            system: "image",
            provider: "photos",
            message: "photos unavailable",
          },
        ];
      } else {
        if (productHeartbeat) clearInterval(productHeartbeat);
        await failJob(
          jobId,
          outcome.reason === "shop" ? BOARD_SHOP_FAIL : BOARD_PHOTOS_FAIL
        );
        return;
      }
    }


    if (productHeartbeat) clearInterval(productHeartbeat);

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { progress: 55 },
    });

    // ──────────────────────────────────────────────────────────────────
    // Step 2: generate the board with the user photo + product thumbnails
    // ──────────────────────────────────────────────────────────────────
    let boardImageUrl: string | null = null;
    const runBoard =
      renderQuality !== "preview" &&
      isImageGenerationConfigured() &&
      productImageRefs.length > 0 &&
      (data.path !== "online" || boardPlan.length > 0);
    if (runBoard) {
      const personBlock = personAnalysisToPromptBlock(personAnalysis);
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { progress: 65 },
      });

      try {
        const prompt = buildFashionBoardPrompt({
          personBlock,
          styleType: data.styleType,
          occasion: data.occasion,
          location: data.location,
          style: data.style,
          budgetMin: data.budgetMin,
          budgetMax: data.budgetMax,
          path: data.path,
          wardrobeSummary,
          looks: boardPlan,
          productImageRefs,
          requireProductRefsPerPanel: true,
        });
        const imageQuality =
          renderQuality === "hd" ? "hd" : ("medium" as const);
        const { value: boardImage, meta: imageMeta } =
          await generateBoardWithFallback({
            prompt,
            quality: imageQuality,
            referenceImageUrl: data.userPhotoUrl,
            productImageUrls,
          });
        Object.assign(
          providerMeta,
          mergeProviderMeta(providerMeta, imageMeta)
        );
        boardImageUrl = await uploadBoardImage(userId, boardImage);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Image generation failed";
        console.warn("Board image generation failed (continuing):", message);
        providerMeta.degraded = true;
        providerMeta.failures = [
          ...(providerMeta.failures ?? []),
          { system: "image", provider: "all", message },
        ];
      }
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { progress: 90 },
    });

    const looks: GenerationLookResult[] = boardPlan.map((planned, i) => ({
      ...planned,
      imageUrl: null,
      products: boardProductResults[i]?.products ?? [],
    }));

    const outfit = await prisma.outfit.create({
      data: {
        userId,
        name: `Styled ${new Date().toISOString().slice(0, 10)}`,
        occasion: data.occasion,
        isSaved: false,
        snapshot: {
          boardImageUrl,
          personAnalysis,
          looks,
          payload: data,
          jobId,
        } as object,
        items: {
          create: looks.flatMap((look, li) =>
            (look.products ?? [])
              .filter((p) => p.productCacheId)
              .map((p, pi) => ({
                position: li * 10 + pi,
                label: look.label ?? `Look ${li + 1}`,
                productCacheId: p.productCacheId!,
                metadata: { title: p.title, storeName: p.storeName },
              }))
          ),
        },
      },
    });

    const result: GenerationJobResult = {
      boardImageUrl,
      personAnalysis: personAnalysis ?? undefined,
      looks,
      outfitId: outfit.id,
      renderQuality,
      previewOnly: renderQuality === "preview",
      productSearchSessionIds: productSearchSessionIds.length
        ? [...new Set(productSearchSessionIds)]
        : undefined,
      providerMeta:
        providerMeta.degraded || providerMeta.failures?.length
          ? providerMeta
          : undefined,
    };

    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.DONE,
        progress: 100,
        result: result as object,
      },
    });

    await persistChatJobResultToMessages({
      userId,
      conversationId: data.conversationId,
      source: data.source,
      jobId,
      boardImageUrl,
      looks,
    }).catch(() => undefined);

    const reservationId = await billingReservationIdFromJob(jobId);
    if (reservationId) {
      const { finalizeUsage } = await import("@/lib/billing/entitlements");
      await finalizeUsage(reservationId, true, jobId).catch(() => undefined);
    }
    // Do not enqueue post-generation crawls that append extra products.
    // Shop links must stay 1:1 with the garments already on the board.
  } catch (e) {
    console.error(e);
    if (productHeartbeat) clearInterval(productHeartbeat);
    await failJob(jobId, e instanceof Error ? e.message : "Generation failed");
  }
}
