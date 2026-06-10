/**
 * Strip sensitive fields from outfit/post payloads returned by public APIs.
 */

type ProductCacheRow = {
  id: string;
  source: string;
  title: string;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
  productUrl: string;
  category: string | null;
  raw?: unknown;
};

type OutfitItemRow = {
  id: string;
  category?: string | null;
  productCache?: ProductCacheRow | null;
  wardrobeItem?: {
    id: string;
    blobPath?: string;
    imageUrl?: string | null;
    notes?: string | null;
    category?: string | null;
    tags?: unknown;
    styleLabels?: unknown;
  } | null;
};

export function sanitizeProductCacheForPublic(
  product: ProductCacheRow | null | undefined
) {
  if (!product) return null;
  return {
    id: product.id,
    source: product.source,
    title: product.title,
    price: product.price,
    currency: product.currency,
    imageUrl: product.imageUrl,
    productUrl: product.productUrl,
    category: product.category,
  };
}

export function sanitizeOutfitItemForPublic(
  item: OutfitItemRow,
  options?: { includeWardrobeSummary?: boolean }
) {
  const base = {
    id: item.id,
    category: item.category,
    productCache: sanitizeProductCacheForPublic(item.productCache),
  };

  if (options?.includeWardrobeSummary && item.wardrobeItem) {
    return {
      ...base,
      wardrobeItem: {
        id: item.wardrobeItem.id,
        category: item.wardrobeItem.category,
      },
    };
  }

  return base;
}

export function sanitizeOutfitForPublic<T extends { items?: OutfitItemRow[] }>(
  outfit: T,
  options?: { includeWardrobeSummary?: boolean }
): T {
  if (!outfit.items) return outfit;
  return {
    ...outfit,
    items: outfit.items.map((item) =>
      sanitizeOutfitItemForPublic(item, options)
    ),
  };
}

export function sanitizePostForPublic<
  T extends { outfit?: { items?: OutfitItemRow[] } | null },
>(post: T, options?: { includeWardrobeSummary?: boolean }): T {
  if (!post.outfit) return post;
  return {
    ...post,
    outfit: sanitizeOutfitForPublic(post.outfit, options),
  };
}
