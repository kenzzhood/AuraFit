import { CrawlJobStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { crawlProductsLive } from "@/lib/ecommerce/providers/crawl-live";
import { upsertProductIndexBatch } from "@/lib/ecommerce/index/persist";
import { rankProductList } from "@/lib/ecommerce/ranking";
import {
  getProductSearchSession,
  updateProductSearchSession,
} from "@/lib/ecommerce/session";
import { setCachedProducts } from "@/lib/ecommerce/cache";
import { productToNormalized } from "@/lib/ecommerce/product";
import { dedupeProducts } from "@/lib/ecommerce/dedupe";
import type { ProductCrawlPayload } from "@/lib/ecommerce/crawl-queue";
import type { GenerationJobResult, LookProduct } from "@/types/generation";
import type { Product } from "@/lib/ecommerce/product";

async function upsertProductCacheId(p: Product): Promise<string | undefined> {
  const norm = productToNormalized(p);
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  try {
    const row = await prisma.productCache.upsert({
      where: {
        source_externalId: { source: norm.source, externalId: norm.externalId },
      },
      create: {
        externalId: norm.externalId,
        source: norm.source,
        title: norm.title,
        price: norm.price != null ? Math.round(norm.price) : undefined,
        currency: norm.currency,
        imageUrl: norm.imageUrl,
        productUrl: norm.productUrl,
        category: norm.category,
        expiresAt,
      },
      update: {
        title: norm.title,
        price: norm.price != null ? Math.round(norm.price) : undefined,
        currency: norm.currency,
        imageUrl: norm.imageUrl,
        productUrl: norm.productUrl,
        category: norm.category,
        expiresAt,
      },
    });
    return row.id;
  } catch (e) {
    console.warn("upsertProductCacheId failed:", e);
    return undefined;
  }
}

export async function processProductCrawlJob(
  payload: ProductCrawlPayload
): Promise<void> {
  const {
    crawlJobId,
    sessionId,
    query,
    rankingContext,
    generationJobId,
    lookIndex,
  } = payload;

  await prisma.crawlJob.update({
    where: { id: crawlJobId },
    data: { status: CrawlJobStatus.PROCESSING, startedAt: new Date() },
  });

  try {
    const crawled = await crawlProductsLive(query);
    await upsertProductIndexBatch(crawled, { embed: true });

    const session = await getProductSearchSession(sessionId);
    const existing = session?.products ?? [];
    const merged = dedupeProducts([...existing, ...crawled]);

    const ranked = await rankProductList(merged, {
      query,
      personAnalysis: rankingContext?.personAnalysis,
      plannedLook: rankingContext?.plannedLook,
    });

    const minResults = Number(process.env.PRODUCT_CRAWL_MIN_RESULTS ?? 4);
    const status = ranked.length >= minResults ? "ready" : "partial";

    await updateProductSearchSession(sessionId, {
      products: ranked,
      status,
      providerMeta: {
        degraded: false,
        providersUsed: ["crawl", "index"],
      },
    });

    await setCachedProducts(query, ranked.map((p) => productToNormalized(p)));

    if (generationJobId) {
      await patchGenerationJobProducts(
        generationJobId,
        ranked,
        query.query,
        lookIndex,
        query.category
      );
    }

    await prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: {
        status: CrawlJobStatus.DONE,
        resultCount: crawled.length,
        completedAt: new Date(),
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Crawl failed";
    await prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: {
        status: CrawlJobStatus.FAILED,
        error: message,
        completedAt: new Date(),
      },
    });
    await updateProductSearchSession(sessionId, {
      status: "failed",
      providerMeta: {
        degraded: true,
        failures: [{ system: "crawl", provider: "crawl", message }],
      },
    });
    throw e;
  }
}

/**
 * Apply async crawl results back to the right look on the saved generation
 * job. When `lookIndex` is provided (post-generation enrichment), we patch
 * that exact panel. Otherwise we score query overlap — never fall back to
 * look 0, which caused duplicate links on panels 4–6.
 *
 * Real products only — we never inject demo/placeholder links here.
 */
async function patchGenerationJobProducts(
  jobId: string,
  products: Product[],
  crawlQuery: string,
  lookIndex?: number,
  matchCategory?: string
): Promise<void> {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job?.result) return;

  const result = job.result as GenerationJobResult;
  const looks = result.looks ?? [];
  if (!looks.length) return;

  const realProducts = products.filter(
    (p) =>
      p.url &&
      p.image &&
      p.source !== "demo" &&
      !/example\.com/i.test(p.url) &&
      p.verified === true &&
      p.availability !== "out_of_stock"
  );
  if (!realProducts.length) return;

  const normCategory = (c?: string) => (c ?? "").toLowerCase().trim();

  const mapped = realProducts.map((p) => ({
    title: p.title,
    productUrl: p.canonicalUrl ?? p.url,
    source: p.source,
    price: p.price,
    currency: p.currency,
    imageUrl: p.image,
    storeName: p.storeName ?? p.brand,
    verified: true as const,
    canonicalUrl: p.canonicalUrl,
    availability: p.availability,
    matchCategory: p.matchCategory,
    matchConfidence: p.matchConfidence,
  }));

  let targetIdx = lookIndex;
  if (targetIdx == null) {
    const norm = (s?: string) => (s ?? "").toLowerCase().trim();
    const qn = norm(crawlQuery);

    const lookCandidates = looks.map((look, idx) => {
      const haystack = [
        look.productSearchQuery,
        ...(look.items ?? []).map((it) => it.searchQuery ?? ""),
      ]
        .map(norm)
        .filter(Boolean);

      const score = haystack.reduce((acc, h) => {
        if (!h) return acc;
        if (h === qn) return acc + 100;
        if (qn.includes(h) || h.includes(qn)) return acc + 50;
        const overlap = qn
          .split(/\s+/)
          .filter((t) => t && h.includes(t)).length;
        return acc + overlap;
      }, 0);

      return { idx, score };
    });

    lookCandidates.sort((a, b) => b.score - a.score);
    targetIdx =
      lookCandidates[0] && lookCandidates[0].score > 0
        ? lookCandidates[0].idx
        : undefined;
  }

  if (targetIdx == null || targetIdx < 0 || targetIdx >= looks.length) return;

  const look = looks[targetIdx];
  if (!look) return;

  const existing = look.products ?? [];
  const globalUsed = new Set(
    looks.flatMap((l) =>
      (l.products ?? [])
        .map((p) => p.canonicalUrl ?? p.productUrl)
        .filter(Boolean)
    )
  );
  const seen = new Set(existing.map((p) => p.canonicalUrl ?? p.productUrl));
  const slotCategory = normCategory(matchCategory);

  const candidates = mapped.filter((m) => {
    const url = m.productUrl;
    if (!url || seen.has(url) || globalUsed.has(url)) return false;
    if (!slotCategory) return true;
    return normCategory(m.matchCategory) === slotCategory;
  });

  const addition = candidates[0];
  if (!addition?.productUrl) return;

  const crawlProduct = realProducts.find(
    (p) => (p.canonicalUrl ?? p.url) === addition.productUrl
  );
  const cacheId = crawlProduct
    ? await upsertProductCacheId(crawlProduct)
    : undefined;
  const enriched: LookProduct = {
    ...addition,
    ...(cacheId ? { productCacheId: cacheId } : {}),
  };

  look.products = [...existing, enriched].slice(0, 5);

  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      result: {
        ...result,
        looks,
        providerMeta: {
          ...(result.providerMeta ?? {}),
          degraded: false,
          providersUsed: [
            ...((result.providerMeta?.providersUsed as string[]) ?? []),
            "crawl",
          ],
        },
      } as object,
    },
  });
}
