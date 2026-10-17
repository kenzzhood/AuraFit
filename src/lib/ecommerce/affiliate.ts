import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { buildAffiliateUrlFromProviders } from "./affiliate/provider";
import {
  pickUsableShopUrl,
  rewriteLegacyRetailerUrl,
  usableMerchantUrl,
} from "./fingerprint";
import { assertAllowedAffiliateUrl } from "@/lib/security/affiliate-url";

/**
 * Live Snitch `/buy` PDPs pass through. Dead `/products/<handle>` and
 * snitch.co.in URLs are a no-op — never rewrite to `/search?q=` and never
 * invent a new `/products/` destination. Host rewrite is not a rescue.
 */
export function rescueSnitchProductUrl(url: string): string {
  const usable = usableMerchantUrl(url);
  return usable ?? url;
}

export function buildAffiliateUrl(
  destination: string,
  source: string,
  trackingId: string
): string {
  const rewritten = pickUsableShopUrl(destination) ?? destination;
  assertAllowedAffiliateUrl(rewritten);
  return buildAffiliateUrlFromProviders({
    destination: rewritten,
    source,
    trackingId,
  });
}

export async function recordAffiliateClick(params: {
  userId: string;
  outfitId?: string;
  source: string;
  targetUrl: string;
  productCacheId?: string;
}) {
  const rewritten = rewriteLegacyRetailerUrl(params.targetUrl);
  const targetUrl = rescueSnitchProductUrl(
    pickUsableShopUrl(rewritten, params.targetUrl) ?? params.targetUrl
  );
  assertAllowedAffiliateUrl(targetUrl);
  const trackingId = nanoid(12);
  const url = buildAffiliateUrl(targetUrl, params.source, trackingId);
  await prisma.affiliateClick.create({
    data: {
      userId: params.userId,
      outfitId: params.outfitId,
      source: params.source,
      targetUrl: url,
      productCacheId: params.productCacheId,
    },
  });
  return { redirectUrl: url, trackingId };
}
