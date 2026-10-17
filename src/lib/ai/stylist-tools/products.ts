import type { StylistProductCard } from "@/lib/ai/stylist-events";
import type { Product } from "@/lib/ecommerce/product";
import { pickUsableShopUrl, isUsableShopUrl } from "@/lib/ecommerce/fingerprint";
import { isRealProduct } from "@/lib/jobs/generation";
import { canonicalItemCategory } from "@/lib/ecommerce/category-match";

export function isShoppableDiscoveredProduct(p: Product): boolean {
  const productUrl = pickUsableShopUrl(p.canonicalUrl, p.url);
  if (!productUrl || !isUsableShopUrl(productUrl)) return false;
  return isRealProduct({
    productUrl,
    imageUrl: p.image,
    source: p.source,
    verified: p.verified === true || p.pdpVerified === true,
    availability: p.availability,
  });
}

export function toStylistProductCard(
  p: Product,
  matchCategory?: string
): StylistProductCard | null {
  const productUrl = pickUsableShopUrl(p.canonicalUrl, p.url);
  if (!productUrl) return null;
  return {
    title: p.title,
    productUrl,
    imageUrl: p.image,
    price: p.price,
    currency: p.currency,
    source: p.source,
    matchCategory:
      matchCategory ??
      (p.matchCategory ? canonicalItemCategory(p.matchCategory) : p.category),
  };
}

export function shoppableProductCards(
  products: Product[],
  opts?: { min?: number; max?: number; matchCategory?: string }
): StylistProductCard[] {
  const min = opts?.min ?? 0;
  const max = opts?.max ?? 8;
  const cards: StylistProductCard[] = [];
  const seen = new Set<string>();
  for (const p of products) {
    if (!isShoppableDiscoveredProduct(p)) continue;
    const card = toStylistProductCard(p, opts?.matchCategory);
    if (!card || seen.has(card.productUrl)) continue;
    seen.add(card.productUrl);
    cards.push(card);
    if (cards.length >= max) break;
  }
  if (cards.length < min) return cards;
  return cards;
}
