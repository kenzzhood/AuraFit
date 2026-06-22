import { nanoid } from "nanoid";
import type { CartItem } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildAffiliateUrlFromProviders } from "@/lib/ecommerce/affiliate/provider";
import type {
  CartItemInput,
  CartItemPublic,
  CartOutfitGroup,
  CartResponse,
  CheckoutGroup,
  CheckoutResponse,
} from "@/types/cart";

const RETAILER_HOSTS: Record<string, string> = {
  "amazon.in": "Amazon",
  "amazon.com": "Amazon",
  "amzn.to": "Amazon",
  "myntra.com": "Myntra",
  "ajio.com": "Ajio",
  "flipkart.com": "Flipkart",
  "nykaa.com": "Nykaa",
  "hm.com": "H&M",
  "zara.com": "Zara",
};

export function inferRetailer(
  productUrl: string,
  storeName?: string | null
): string {
  if (storeName?.trim()) return storeName.trim();
  try {
    const host = new URL(productUrl).hostname.replace(/^www\./, "");
    for (const [pattern, label] of Object.entries(RETAILER_HOSTS)) {
      if (host.includes(pattern)) return label;
    }
    const parts = host.split(".");
    if (parts.length >= 2) {
      const name = parts[parts.length - 2];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  } catch {
    /* ignore */
  }
  return "Other";
}

export function inferAffiliateNetwork(productUrl: string): string | null {
  try {
    const host = new URL(productUrl).hostname;
    if (host.includes("amazon.") || host.includes("amzn.")) {
      return "amazon_associates";
    }
  } catch {
    /* ignore */
  }
  return "generic";
}

export function resolveAffiliateUrl(
  productUrl: string,
  source = "cart"
): string {
  const trackingId = nanoid(12);
  return buildAffiliateUrlFromProviders({
    destination: productUrl,
    source,
    trackingId,
  });
}

export function toCartItemPublic(item: CartItem): CartItemPublic {
  const effectiveUrl = item.affiliateUrl ?? item.productUrl;
  return {
    id: item.id,
    productCacheId: item.productCacheId,
    outfitId: item.outfitId,
    outfitLabel: item.outfitLabel,
    title: item.title,
    imageUrl: item.imageUrl,
    productUrl: item.productUrl,
    affiliateUrl: item.affiliateUrl,
    effectiveUrl,
    retailer: item.retailer,
    affiliateNetwork: item.affiliateNetwork,
    price: item.price,
    currency: item.currency,
    category: item.category,
    quantity: item.quantity,
    addedAt: item.addedAt.toISOString(),
  };
}

export async function getOrCreateCart(userId: string) {
  const existing = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { orderBy: { addedAt: "desc" } } },
  });
  if (existing) return existing;

  return prisma.cart.create({
    data: { userId },
    include: { items: { orderBy: { addedAt: "desc" } } },
  });
}

function computeSubtotal(items: CartItemPublic[]): number {
  return items.reduce(
    (sum, item) => sum + (item.price ?? 0) * item.quantity,
    0
  );
}

export function groupByOutfit(items: CartItemPublic[]): CartOutfitGroup[] {
  const map = new Map<string, CartOutfitGroup>();
  for (const item of items) {
    const key = item.outfitId ?? "__ungrouped__";
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(key, {
        outfitId: item.outfitId,
        outfitLabel: item.outfitLabel,
        items: [item],
      });
    }
  }
  return Array.from(map.values());
}

export function buildCartResponse(
  cartId: string,
  items: CartItem[]
): CartResponse {
  const publicItems = items.map(toCartItemPublic);
  const currency = publicItems[0]?.currency ?? "INR";
  return {
    id: cartId,
    itemCount: publicItems.reduce((n, i) => n + i.quantity, 0),
    subtotal: computeSubtotal(publicItems),
    currency,
    items: publicItems,
    byOutfit: groupByOutfit(publicItems),
  };
}

export async function addItemsToCart(
  userId: string,
  inputs: CartItemInput[]
): Promise<CartResponse> {
  const cart = await getOrCreateCart(userId);
  const data = inputs.map((input) => {
    const productUrl = input.productUrl;
    const affiliateUrl = resolveAffiliateUrl(productUrl, "cart_add");
    const retailer =
      input.retailer ?? inferRetailer(productUrl);
    return {
      cartId: cart.id,
      productCacheId: input.productCacheId ?? null,
      outfitId: input.outfitId ?? null,
      outfitLabel: input.outfitLabel ?? null,
      title: input.title,
      imageUrl: input.imageUrl ?? null,
      productUrl,
      affiliateUrl,
      retailer,
      affiliateNetwork: inferAffiliateNetwork(productUrl),
      price: input.price ?? null,
      currency: input.currency ?? "INR",
      category: input.category ?? null,
      quantity: input.quantity ?? 1,
    };
  });

  await prisma.cartItem.createMany({ data });

  const updated = await prisma.cart.findUniqueOrThrow({
    where: { id: cart.id },
    include: { items: { orderBy: { addedAt: "desc" } } },
  });

  return buildCartResponse(updated.id, updated.items);
}

export function buildCheckoutResponse(items: CartItem[]): CheckoutResponse {
  const publicItems = items.map(toCartItemPublic);
  const currency = publicItems[0]?.currency ?? "INR";
  const byRetailer = new Map<string, CartItemPublic[]>();

  for (const item of publicItems) {
    const key = item.retailer ?? "Other";
    const list = byRetailer.get(key) ?? [];
    list.push(item);
    byRetailer.set(key, list);
  }

  const groups: CheckoutGroup[] = Array.from(byRetailer.entries()).map(
    ([retailer, groupItems]) => {
      const urls = groupItems.map((i) => i.effectiveUrl);
      const openAllUrl =
        urls.length > 1
          ? `https://aurafit.app/checkout?urls=${encodeURIComponent(urls.join("|"))}`
          : urls[0] ?? null;

      return {
        retailer,
        itemCount: groupItems.reduce((n, i) => n + i.quantity, 0),
        subtotal: computeSubtotal(groupItems),
        currency,
        items: groupItems,
        openAllUrl,
      };
    }
  );

  return {
    itemCount: publicItems.reduce((n, i) => n + i.quantity, 0),
    subtotal: computeSubtotal(publicItems),
    currency,
    groups,
  };
}
