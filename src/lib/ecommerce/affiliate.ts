import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { buildAffiliateUrlFromProviders } from "./affiliate/provider";

export function buildAffiliateUrl(
  destination: string,
  source: string,
  trackingId: string
): string {
  return buildAffiliateUrlFromProviders({ destination, source, trackingId });
}

export async function recordAffiliateClick(params: {
  userId: string;
  outfitId?: string;
  source: string;
  targetUrl: string;
  productCacheId?: string;
}) {
  const trackingId = nanoid(12);
  const url = buildAffiliateUrl(params.targetUrl, params.source, trackingId);
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
