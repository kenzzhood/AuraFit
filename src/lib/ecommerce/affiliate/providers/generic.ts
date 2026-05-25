import type { AffiliateLinkInput, AffiliateProvider } from "./types";

export const genericAffiliateProvider: AffiliateProvider = {
  name: "generic",
  isConfigured: () => true,
  buildUrl({ destination, source, trackingId }: AffiliateLinkInput) {
    const u = new URL(destination);
    u.searchParams.set("utm_source", "aurafit");
    u.searchParams.set("utm_medium", "affiliate");
    u.searchParams.set("utm_campaign", source);
    u.searchParams.set("aurafit_ref", trackingId);
    return u.toString();
  },
};
