import { prisma } from "@/lib/prisma";
import type { ProductQuery } from "@/lib/ecommerce/providers/types";
import type { Product } from "@/lib/ecommerce/product";
import { indexRowToProduct } from "./persist";
import { getOrCreateTextEmbedding, searchProductsByVector } from "./embeddings";
import { dedupeProducts } from "@/lib/ecommerce/dedupe";

export async function searchProductIndex(
  q: ProductQuery,
  options?: { limit?: number }
): Promise<Product[]> {
  const limit = options?.limit ?? 12;
  const region = q.region;

  let vectorResults: Product[] = [];
  try {
    const queryText = [q.query, q.category, ...(q.aestheticKeywords ?? [])]
      .filter(Boolean)
      .join(" ");
    const vector = await getOrCreateTextEmbedding(queryText);
    const hits = await searchProductsByVector({
      vector,
      region,
      limit,
    });

    if (hits.length) {
      const ids = hits.map((h) => h.productIndexId);
      const rows = await prisma.productIndex.findMany({
        where: { id: { in: ids } },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      vectorResults = hits
        .map((h) => {
          const row = byId.get(h.productIndexId);
          return row ? indexRowToProduct(row) : null;
        })
        .filter((p): p is Product => !!p);
    }
  } catch (e) {
    console.warn("Vector product search failed, using text fallback:", e);
  }

  const textRows = await prisma.productIndex.findMany({
    where: {
      region,
      OR: [
        { title: { contains: q.query, mode: "insensitive" } },
        { brand: { contains: q.query, mode: "insensitive" } },
        { category: { contains: q.category, mode: "insensitive" } },
      ],
      ...(q.budgetMax != null ? { price: { lte: Math.ceil(q.budgetMax) } } : {}),
      ...(q.budgetMin != null ? { price: { gte: Math.floor(q.budgetMin) } } : {}),
    },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  const textResults = textRows.map((r) => indexRowToProduct(r));
  const merged = dedupeProducts([...vectorResults, ...textResults]);
  return merged.slice(0, limit);
}
