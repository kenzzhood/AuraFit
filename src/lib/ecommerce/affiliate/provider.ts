import { parseProviderOrder } from "@/lib/providers/env";
import { amazonAffiliateProvider } from "./providers/amazon";
import { genericAffiliateProvider } from "./providers/generic";
import type { AffiliateLinkInput, AffiliateProvider } from "./providers/types";

const REGISTRY: Record<string, AffiliateProvider> = {
  amazon: amazonAffiliateProvider,
  generic: genericAffiliateProvider,
};

export function getAffiliateProvidersOrdered(): AffiliateProvider[] {
  const order = parseProviderOrder("AFFILIATE_PROVIDERS", [
    "amazon",
    "generic",
  ]);
  return order
    .map((name) => REGISTRY[name])
    .filter((p): p is AffiliateProvider => !!p);
}

export function buildAffiliateUrlFromProviders(
  input: AffiliateLinkInput
): string {
  const providers = getAffiliateProvidersOrdered();
  for (const p of providers) {
    if (p.isConfigured()) return p.buildUrl(input);
  }
  return genericAffiliateProvider.buildUrl(input);
}
