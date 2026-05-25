import type { AffiliateLinkInput, AffiliateProvider } from "./types";

export const amazonAffiliateProvider: AffiliateProvider = {
  name: "amazon",
  isConfigured: () => !!process.env.AMAZON_ASSOCIATE_TAG,
  buildUrl({ destination, source, trackingId }: AffiliateLinkInput) {
    const tag = process.env.AMAZON_ASSOCIATE_TAG ?? "aurafit-21";
    const u = new URL(destination);
    if (
      u.hostname.includes("amazon.") ||
      u.hostname.includes("amzn.")
    ) {
      u.searchParams.set("tag", tag);
    }
    u.searchParams.set("utm_source", "aurafit");
    u.searchParams.set("utm_medium", "affiliate");
    u.searchParams.set("utm_campaign", source);
    u.searchParams.set("aurafit_ref", trackingId);
    return u.toString();
  },
};
