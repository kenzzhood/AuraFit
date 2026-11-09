/**
 * Paid web search is off for AuraFit.
 * SerpAPI and Google Shopping stay in the legacy consumer code only as inert adapters.
 * They run solely when an operator sets an explicit allow flag. The store product never calls them.
 */

export function paidSearchAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.AURAFIT_ALLOW_PAID_SEARCH === "true";
}

export function googleShoppingAllowed(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env.AURAFIT_ALLOW_GOOGLE_SHOPPING === "true";
}
