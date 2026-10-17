import type { LookProduct } from "@/types/generation";
import type { CartItemInput } from "@/types/cart";
import { pickUsableShopUrl } from "@/lib/ecommerce/fingerprint";

function isShoppable(p: LookProduct): boolean {
  if (p.kind === "wardrobe") return false;
  const shopUrl = pickUsableShopUrl(p.canonicalUrl, p.productUrl);
  if (!shopUrl) return false;
  if (p.source === "demo") return false;
  if (/example\.com/i.test(shopUrl)) return false;
  if (p.verified !== true) return false;
  if (p.availability === "out_of_stock") return false;
  return true;
}

export function lookProductToCartInput(
  p: LookProduct,
  opts?: { outfitId?: string | null; outfitLabel?: string }
): CartItemInput | null {
  const url = pickUsableShopUrl(p.canonicalUrl, p.productUrl);
  if (!url || !isShoppable(p)) return null;
  return {
    productCacheId: p.productCacheId,
    outfitId: opts?.outfitId ?? undefined,
    outfitLabel: opts?.outfitLabel,
    title: p.title ?? "Product",
    imageUrl: p.imageUrl,
    productUrl: url,
    retailer: p.storeName ?? p.source,
    price: p.price,
    currency: p.currency,
    category: p.matchCategory,
  };
}
