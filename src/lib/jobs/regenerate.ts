import { prisma } from "@/lib/prisma";
import { cacheProduct, isRealProduct } from "@/lib/jobs/generation";
import type {
  GenerationJobResult,
  GenerationLookResult,
  LookProduct,
} from "@/types/generation";
import type { NormalizedProduct } from "@/lib/ecommerce/product";

/**
 * A real product the client picked to swap into a look. Mirrors the normalized
 * shape returned by GET /api/products/session/[id] so the UI can hand a
 * candidate straight back. Re-validated server-side before it is trusted.
 */
export type ReplacementProduct = {
  externalId?: string;
  title: string;
  productUrl: string;
  source: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  storeName?: string;
  canonicalUrl?: string;
  availability?: "in_stock" | "out_of_stock" | "unknown";
  matchCategory?: string;
};

function lookProductsEqual(a: LookProduct, url: string): boolean {
  return a.productUrl === url || a.canonicalUrl === url;
}

/**
 * Replace a single product inside one look with another real candidate.
 *
 * Reuses the cached per-slot candidate list (no re-crawl): the client fetches
 * alternatives via the slot's `sessionId`, picks one, and posts it here. We
 * re-validate it is a real, shoppable product, cache it, swap it into the job
 * result (and the saved outfit snapshot), then return the updated look.
 */
export async function replaceLookProduct(params: {
  userId: string;
  jobId: string;
  lookIndex: number;
  /** URL of the product currently in the slot (preferred matcher). */
  currentProductUrl?: string;
  replacement: ReplacementProduct;
}): Promise<{ look: GenerationLookResult }> {
  const job = await prisma.generationJob.findFirst({
    where: { id: params.jobId, userId: params.userId },
  });
  if (!job?.result) {
    throw new Error("Generation job not found");
  }

  const result = job.result as GenerationJobResult;
  const looks = result.looks ?? [];
  const look = looks[params.lookIndex];
  if (!look) {
    throw new Error("Look not found");
  }

  const norm: NormalizedProduct = {
    externalId:
      params.replacement.externalId ??
      params.replacement.canonicalUrl ??
      params.replacement.productUrl,
    source: params.replacement.source,
    title: params.replacement.title,
    price: params.replacement.price,
    currency: params.replacement.currency ?? "INR",
    imageUrl: params.replacement.imageUrl,
    productUrl: params.replacement.productUrl,
    storeName: params.replacement.storeName,
    verified: true,
    canonicalUrl: params.replacement.canonicalUrl,
    availability: params.replacement.availability ?? "in_stock",
    matchCategory: params.replacement.matchCategory,
  };

  if (!isRealProduct(norm)) {
    throw new Error("Replacement is not a verified, shoppable product");
  }

  const row = await cacheProduct(norm);
  const productUrl = norm.canonicalUrl ?? norm.productUrl;
  const replacement: LookProduct = {
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
    matchCategory: norm.matchCategory,
    matchConfidence: norm.matchConfidence,
    kind: "online",
  };

  const products = [...(look.products ?? [])];
  // Prefer matching by the outgoing URL; otherwise match by slot category.
  let idx = params.currentProductUrl
    ? products.findIndex((p) => lookProductsEqual(p, params.currentProductUrl!))
    : -1;
  if (idx === -1 && norm.matchCategory) {
    idx = products.findIndex((p) => p.matchCategory === norm.matchCategory);
  }
  if (idx === -1) {
    products.push(replacement);
  } else {
    // Carry the replaced slot's session so the user can keep swapping.
    replacement.sessionId = products[idx]?.sessionId;
    products[idx] = replacement;
  }

  const updatedLook: GenerationLookResult = { ...look, products };
  const updatedLooks = looks.map((l, i) =>
    i === params.lookIndex ? updatedLook : l
  );
  const updatedResult: GenerationJobResult = { ...result, looks: updatedLooks };

  await prisma.generationJob.update({
    where: { id: params.jobId },
    data: { result: updatedResult as object },
  });

  // Keep the saved outfit snapshot in sync so /outfits and the look detail
  // panel show the swapped product too.
  if (result.outfitId) {
    try {
      const outfit = await prisma.outfit.findFirst({
        where: { id: result.outfitId, userId: params.userId },
      });
      if (outfit?.snapshot && typeof outfit.snapshot === "object") {
        const snap = outfit.snapshot as Record<string, unknown>;
        const snapLooks = Array.isArray(snap.looks)
          ? (snap.looks as GenerationLookResult[])
          : null;
        if (snapLooks && snapLooks[params.lookIndex]) {
          snapLooks[params.lookIndex] = updatedLook;
          await prisma.outfit.update({
            where: { id: outfit.id },
            data: { snapshot: { ...snap, looks: snapLooks } as object },
          });
        }
      }
    } catch (e) {
      console.warn("replaceLookProduct: outfit snapshot sync failed:", e);
    }
  }

  return { look: updatedLook };
}
