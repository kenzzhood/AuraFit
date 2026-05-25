import { JobStatus, JobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateJobSchema } from "@/types/api";
import {
  discoverProducts,
  locationToRegion,
} from "@/lib/ecommerce/discovery";
import { createProductSearchSession } from "@/lib/ecommerce/session";
import { enqueueProductCrawl } from "@/lib/ecommerce/crawl-queue";
import { productToNormalized } from "@/lib/ecommerce/product";
import type { NormalizedProduct } from "@/lib/ecommerce/providers/types";
import type { ProductQuery } from "@/lib/ecommerce/providers/types";
import {
  generateLooksWithFallback,
  isImageGenerationConfigured,
} from "@/lib/ai/provider";
import type { WardrobeContext } from "@/lib/ai/providers/types";
import {
  generateBoardWithFallback,
} from "@/lib/image/provider";
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

const AZURE_WARDROBE_CONTAINER =
  process.env.AZURE_STORAGE_CONTAINER_WARDROBES ?? "wardrobes";

async function failJob(jobId: string, message: string) {
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: JobStatus.FAILED, error: message },
  });
}

async function cacheProduct(p: NormalizedProduct) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
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
      productUrl: p.productUrl,
      category: p.category,
      expiresAt,
    },
    update: {
      title: p.title,
      price: p.price != null ? Math.round(p.price) : undefined,
      currency: p.currency,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
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
};

const MAX_PRODUCTS_PER_LOOK = 3;
const MAX_ENRICHED_PRODUCTS_PER_LOOK = 5;

/** Tracks product URLs already assigned to another look in this generation. */
class UsedProductTracker {
  private urls = new Set<string>();

  tryClaim(url: string | undefined | null): boolean {
    if (!url) return false;
    if (this.urls.has(url)) return false;
    this.urls.add(url);
    return true;
  }
}
const PRODUCT_LOOK_CONCURRENCY = 3;
// Slots within a single look (top / bottom / shoes / accessory) are independent
// queries, so we run them in parallel. The crawler call has its own 12s timeout
// (see google-shopping.ts), which is what actually bounds latency here.
const PRODUCT_SLOT_CONCURRENCY = 3;
// Hard cap on how many product reference images we feed into the image-edit
// call. More refs = slower upload AND a slower model response. 4 keeps the
// payload tight while still giving the prompt enough garments to anchor the
// rendered outfits.
const MAX_PRODUCT_IMAGE_REFS = 4;

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

function productSlotPriority(category: string): number {
  switch (category) {
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

function buildFashionBoardPrompt(params: {
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
}): string {
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

  // Category-ordering for readability — outerwear → top → bottom → shoes → accessory
  const categoryOrder = ["outerwear", "top", "bottom", "shoes", "accessory"];
  const sortByCategory = (a: ProductImageRef, b: ProductImageRef) => {
    const ai = categoryOrder.indexOf(a.category);
    const bi = categoryOrder.indexOf(b.category);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  };

  const lookLines = params.looks
    .map((l, i) => {
      const head = `PANEL ${i + 1} — "${l.label}"${l.tagline ? ` (${l.tagline})` : ""}: ${l.description ?? l.productSearchQuery}.`;
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
        return `${head} ${ingredients}. Render each garment with exact fidelity to its reference image — same colour, fabric, pattern, cut, and details. Add only the minimal additional pieces required to complete the outfit (e.g. shoes, accessories) if a slot is not provided.`;
      }
      return `${head} Complete outfit including top, bottom, shoes, and accessories.`;
    })
    .join("\n");

  const ingredientsHeader = params.productImageRefs?.length
    ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERENCE IMAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- [Image 1] is the SUBJECT's reference photo — preserve their face/identity.
- [Image 2] onward are REAL product photographs that we verified against live product detail pages on Flipkart/Amazon.
- For every panel, use ONLY the garments named in that panel's "Use ..." instructions.
- Match the actual product 1:1: colour, fabric, pattern, cut, logo placement, hardware.
- Do NOT substitute or invent new pieces for slots that have a referenced image.
- For slots a panel does not specify (e.g. shoes when only top/bottom are referenced), fill them with tasteful pieces that pair with the referenced items.\n`
    : "";

  return `You are an elite celebrity fashion stylist and luxury editorial creative director. Generate ONE single ultra-premium fashion styling board image.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUBJECT IDENTITY (APPLY TO ALL 6 PANELS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${params.personBlock}
${ingredientsHeader}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STYLING CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Style: ${params.styleType ?? "smart casual"}
- Occasion: ${params.occasion ?? "daily outing"}
- Location & climate: ${params.location ?? "India"}
- Aesthetic preference: ${params.style ?? "modern premium, wearable fashion"}
- Budget: ${budget}
- Mode: ${params.path === "wardrobe" ? "restyling existing wardrobe pieces" : "fresh shopping looks — real-world wearable"}
${params.wardrobeSummary ? `- Existing wardrobe: ${params.wardrobeSummary}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THE 6 LOOKS — ONE PER PANEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${lookLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- ONE single image divided into 6 equal vertical panels side by side
- Each panel numbered clearly 1–6 at the top
- Same person, full body head-to-toe, standing naturally in each panel
- Different complete outfit per panel
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
- Footwear and accessories rendered with photographic accuracy
- Camera realism: Hasselblad / Phase One — sharp, natural lens compression, no distortion

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- The face must be IDENTICAL in all 6 panels — same skin tone, eye shape, nose, jawline, hairline
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
}): Promise<PlannedLook[]> {
  const fallback = Array.from({ length: 6 }, (_, i) => ({
    productSearchQuery: [
      input.styleType,
      input.style,
      input.occasion,
      input.location,
      "contemporary Indian smart casual",
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || `outfit variation ${i + 1}`,
    label: ["Minimal Classic", "Earthy Linen", "Street Minimal", "Smart Layered", "Resort Vibes", "Evening Edge"][i] ?? `Look ${i + 1}`,
    tagline: "Curated for you",
    description: `A complete ${input.styleType ?? "casual"} outfit for ${input.occasion ?? "your day"}.`,
    bestFor: input.occasion ?? "Daily wear",
    priceRange:
      input.budgetMin != null && input.budgetMax != null
        ? `₹${input.budgetMin}–₹${input.budgetMax}`
        : undefined,
    items: [
      { category: "top", description: "Premium top", searchQuery: "linen shirt men" },
      { category: "bottom", description: "Tailored trousers", searchQuery: "relaxed trousers men" },
      { category: "shoes", description: "Clean sneakers", searchQuery: "white sneakers men" },
    ],
  }));

  try {
    const { value: plan } = await generateLooksWithFallback({
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
    });
    if (!plan.length) return fallback;
    while (plan.length < 6) {
      plan.push({
        ...fallback[plan.length]!,
        label: `Look ${plan.length + 1}`,
      });
    }
    return plan.slice(0, 6);
  } catch (e) {
    console.warn("LLM look planning failed, using fallback:", e);
    return fallback;
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
function isRealProduct(p: {
  productUrl?: string;
  imageUrl?: string;
  source?: string;
  verified?: boolean;
  availability?: "in_stock" | "out_of_stock" | "unknown";
}): boolean {
  if (!p.productUrl) return false;
  if (!p.imageUrl) return false;
  if (p.source === "demo") return false;
  if (/example\.com/i.test(p.productUrl)) return false;
  if (p.verified !== true) return false;
  if (p.availability === "out_of_stock") return false;
  return true;
}

/**
 * Normalize a free-form category label from the LLM look plan into the small
 * fixed set we use for UI labels and image-prompt slotting.
 */
function canonicalItemCategory(raw: string | undefined): string {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s) return "garment";
  if (/(dress|gown|jumpsuit|romper|saree|sari|kurta|lehenga)/.test(s)) return "dress";
  if (/(jacket|blazer|coat|outer|overcoat|trench)/.test(s)) return "outerwear";
  if (/(shirt|tee|t-?shirt|top|blouse|polo|knit|sweater|hoodie)/.test(s)) return "top";
  if (/(jean|trouser|pant|chino|short|bottom|skirt|cargo)/.test(s)) return "bottom";
  if (/(shoe|sneaker|loafer|boot|footwear|sandal|heel)/.test(s)) return "shoes";
  if (/(watch|belt|bag|clutch|purse|hat|cap|sunglass|accessor|scarf|jewel|earring|necklace|bracelet)/.test(s)) return "accessory";
  return s;
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

/**
 * Resolve products for a single item slot (e.g. blazer for look 1). Pulls
 * candidates from the discovery pipeline (cache → index → verified crawl) and
 * picks at most one product that survives the `isRealProduct` filter.
 */
async function productsForItem(args: {
  look: PlannedLook;
  category: string;
  searchQuery: string;
  region: "IN" | "US" | "UK";
  usedProducts: UsedProductTracker;
  data: {
    style?: string;
    budgetMin?: number;
    budgetMax?: number;
    personAnalysis?: PersonAnalysis | null;
    userId?: string;
    generationJobId?: string;
  };
}): Promise<{ product: LookProduct | null; sessionId?: string }> {
  const { look, category, searchQuery, region, data, usedProducts } = args;

  const query = {
    query: `${searchQuery} ${data.style ?? ""}`.trim(),
    category,
    region,
    // Budget is for the whole outfit, not each individual item. Applying the
    // outfit minimum per product rejects normal pieces like heels, earrings,
    // bags, and belts.
    budgetMin: undefined,
    budgetMax: data.budgetMax,
    aestheticKeywords: look.tagline
      ? ([look.tagline, look.label].filter(Boolean) as string[])
      : undefined,
  } as const;

  const discovered = await discoverProducts({
    query,
    userId: data.userId,
    generationJobId: data.generationJobId,
    rankingContext: {
      query,
      personAnalysis: data.personAnalysis,
      plannedLook: look,
    },
    allowAsyncCrawl: true,
  });


  for (const p of discovered.products) {
    const norm = productToNormalized(p);
    if (!isRealProduct(norm)) continue;
    const productUrl = norm.canonicalUrl ?? norm.productUrl;
    if (!usedProducts.tryClaim(productUrl)) continue;
    const row = await cacheProduct(norm);
    return {
      product: {
        title: norm.title,
        productUrl,
        source: norm.source,
        productCacheId: row.id,
        price: norm.price,
        currency: norm.currency,
        imageUrl: norm.imageUrl,
        storeName: norm.storeName,
        verified: true,
        canonicalUrl: norm.canonicalUrl,
        availability: norm.availability,
        matchCategory: category,
        matchConfidence: norm.matchConfidence,
      },
      sessionId: discovered.sessionId,
    };
  }

  return { product: null, sessionId: discovered.sessionId };
}

async function enqueuePostGenerationProductEnrichment(params: {
  jobId: string;
  userId: string;
  plan: PlannedLook[];
  productResults: Array<{ products: LookProduct[]; sessionId?: string }>;
  style?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  personAnalysis?: PersonAnalysis | null;
  existingSessionIds: string[];
}): Promise<string[]> {
  const region = locationToRegion(params.location);
  const sessionIds = new Set(params.existingSessionIds);

  for (let lookIndex = 0; lookIndex < params.plan.length; lookIndex++) {
    const look = params.plan[lookIndex]!;
    const existingCategories = new Set(
      (params.productResults[lookIndex]?.products ?? [])
        .map((p) => p.matchCategory)
        .filter(Boolean)
    );

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
    const missingSlots = baseItems
      .filter((s) => {
        if (!s.searchQuery) return false;
        if (seenCategory.has(s.category)) return false;
        seenCategory.add(s.category);
        return !existingCategories.has(s.category);
      })
      .sort(
        (a, b) =>
          productSlotPriority(a.category) - productSlotPriority(b.category)
      )
      .slice(
        0,
        Math.max(
          0,
          MAX_ENRICHED_PRODUCTS_PER_LOOK -
            (params.productResults[lookIndex]?.products.length ?? 0)
        )
      );

    for (const slot of missingSlots) {
      const query: ProductQuery = {
        query: `${slot.searchQuery} ${params.style ?? ""}`.trim(),
        category: slot.category,
        region,
        budgetMin: undefined,
        budgetMax: params.budgetMax,
        aestheticKeywords: look.tagline
          ? ([look.tagline, look.label].filter(Boolean) as string[])
          : undefined,
      };

      const sessionId = await createProductSearchSession({
        userId: params.userId,
        generationJobId: params.jobId,
        query,
        products: [],
        status: "partial",
        providerMeta: { providersUsed: ["crawl-queued"] },
      });
      sessionIds.add(sessionId);

      await enqueueProductCrawl({
        sessionId,
        query,
        userId: params.userId,
        generationJobId: params.jobId,
        lookIndex,
        rankingContext: {
          query,
          personAnalysis: params.personAnalysis,
          plannedLook: look,
        },
      });
    }
  }

  return [...sessionIds];
}

/**
 * Resolve verified products for every item in a look, one slot at a time.
 *
 * Each look's `items[]` (top / bottom / outerwear / shoes / accessory) gets
 * its own targeted search so the final list is category-mapped. We never
 * accept a snippet product and we never duplicate the same product URL
 * across slots inside one look.
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
  }
): Promise<{ products: LookProduct[]; sessionId?: string }> {
  const region = locationToRegion(data.location);

  // Build the slot list. Prefer `items[]` from the LLM plan; if absent, fall
  // back to a sane default set so the look still has something to resolve.
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

  // Dedupe slots by canonical category, then cap each look to 1–3 products.
  // Launching every planned item for every panel overwhelms the live crawler
  // and leaves the UI stuck on "Verifying…".
  const seenCategory = new Set<string>();
  const slots = baseItems
    .filter((s) => {
      if (seenCategory.has(s.category)) return false;
      seenCategory.add(s.category);
      return !!s.searchQuery;
    })
    .sort(
      (a, b) =>
        productSlotPriority(a.category) - productSlotPriority(b.category)
    )
    .slice(0, MAX_PRODUCTS_PER_LOOK);

  // Resolve slots gently because each one can trigger Playwright/Crawl4AI.
  const resolved = await mapWithConcurrency(
    slots,
    PRODUCT_SLOT_CONCURRENCY,
    (s) =>
      productsForItem({
        look,
        category: s.category,
        searchQuery: s.searchQuery,
        region,
        data,
        usedProducts: data.usedProducts,
      }).catch((err) => {
        console.warn(
          `productsForItem failed (${s.category} / ${s.searchQuery}):`,
          err
        );
        return { product: null as LookProduct | null, sessionId: undefined };
      })
  );

  const sessionIds: string[] = [];
  const seenUrl = new Set<string>();
  const products: LookProduct[] = [];
  for (const r of resolved) {
    if (r.sessionId) sessionIds.push(r.sessionId);
    if (!r.product?.productUrl) continue;
    if (seenUrl.has(r.product.productUrl)) continue;
    seenUrl.add(r.product.productUrl);
    products.push(r.product);
  }


  return {
    products: products.slice(0, MAX_PRODUCTS_PER_LOOK),
    sessionId: sessionIds[0],
  };
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

  try {
    await prisma.generationJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.PROCESSING,
        progress: 8,
        payload: { ...(data as object), cancelled: false },
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

    const plan = await planLooks({
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
    });

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { progress: 42 },
    });

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
        PRODUCT_LOOK_CONCURRENCY,
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
            style: data.style,
            location: data.location,
            budgetMin: data.budgetMin,
            budgetMax: data.budgetMax,
            personAnalysis,
            userId,
            generationJobId: jobId,
            usedProducts,
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
        PRODUCT_LOOK_CONCURRENCY,
        (planned) =>
          productsForLook(planned, {
            style: data.style,
            location: data.location,
            budgetMin: data.budgetMin,
            budgetMax: data.budgetMax,
            personAnalysis,
            userId,
            generationJobId: jobId,
            usedProducts,
          }).catch((err) => {
            console.warn("productsForLook failed:", err);
            return { products: [] as LookProduct[], sessionId: undefined };
          })
      );
    }

    const productSearchSessionIds: string[] = [];
    for (const r of productResults) {
      if (r.sessionId) productSearchSessionIds.push(r.sessionId);
    }

    // Build the image-edit ingredient list: user photo is Image 1, then each
    // unique real product becomes Image 2..N. `productImageRefs` tells the
    // prompt which Image N maps to which panel and which outfit slot.
    //
    // Only verified, in-stock products with images make it here — they are
    // the single source of truth for both the rendered board and the
    // "Shop this look" list.
    const productImageUrls: string[] = [];
    const productImageRefs: ProductImageRef[] = [];
    const urlToImageIndex = new Map<string, number>();
    productResults.forEach((res, lookIndex) => {
      for (const p of res.products) {
        if (!p.imageUrl) continue;
        if (p.verified !== true) continue;
        let imageIndex = urlToImageIndex.get(p.imageUrl);
        if (imageIndex == null) {
          imageIndex = productImageUrls.length + 2; // 1 is the user photo
          urlToImageIndex.set(p.imageUrl, imageIndex);
          productImageUrls.push(p.imageUrl);
        }
        productImageRefs.push({
          lookIndex,
          imageIndex,
          category: p.matchCategory ?? "garment",
          title: p.title ?? "product",
          source: p.source,
        });
      }
    });


    await prisma.generationJob.update({
      where: { id: jobId },
      data: { progress: 55 },
    });

    // ──────────────────────────────────────────────────────────────────
    // Step 2: generate the board with the user photo + product thumbnails
    // ──────────────────────────────────────────────────────────────────
    let boardImageUrl: string | null = null;
    const runBoard =
      renderQuality !== "preview" && isImageGenerationConfigured();
    if (runBoard) {
      const personBlock = personAnalysisToPromptBlock(personAnalysis);
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
        looks: plan,
        productImageRefs,
      });

      await prisma.generationJob.update({
        where: { id: jobId },
        data: { progress: 65 },
      });

      try {
        const imageQuality =
          renderQuality === "hd" ? "hd" : ("medium" as const);
        // Cap product references before handing them to the image API. The
        // azure/images.ts layer also clips, but trimming here keeps the
        // upload-fetch fan-out small in the first place. See
        // MAX_PRODUCT_IMAGE_REFS for the rationale.
        const refImageUrls = productImageUrls.slice(0, MAX_PRODUCT_IMAGE_REFS);
        const { value: boardImage, meta: imageMeta } =
          await generateBoardWithFallback({
            prompt,
            quality: imageQuality,
            referenceImageUrl: data.userPhotoUrl,
            productImageUrls: refImageUrls,
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

    const looks: GenerationLookResult[] = plan.map((planned, i) => ({
      ...planned,
      imageUrl: null,
      products: productResults[i]?.products ?? [],
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

    if (data.path === "online") {
      enqueuePostGenerationProductEnrichment({
        jobId,
        userId,
        plan,
        productResults,
        style: data.style,
        location: data.location,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        personAnalysis,
        existingSessionIds: productSearchSessionIds,
      })
        .then(async (sessionIds) => {
          await prisma.generationJob.update({
            where: { id: jobId },
            data: {
              result: {
                ...result,
                productSearchSessionIds: sessionIds.length
                  ? [...new Set(sessionIds)]
                  : undefined,
                providerMeta: {
                  ...(result.providerMeta ?? {}),
                  providersUsed: [
                    ...((result.providerMeta?.providersUsed as string[]) ?? []),
                    "crawl-queued",
                  ],
                },
              } as object,
            },
          });
        })
        .catch((err) =>
          console.warn("Post-generation product enrichment failed:", err)
        );
    }
  } catch (e) {
    console.error(e);
    await failJob(jobId, e instanceof Error ? e.message : "Generation failed");
  }
}
