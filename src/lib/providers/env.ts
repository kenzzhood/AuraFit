/**
 * Parse comma-separated provider order from env.
 * Example: PRODUCT_SEARCH_PROVIDERS=serpapi,demo
 */
export function parseProviderOrder(
  envKey: string,
  fallback: string[]
): string[] {
  const raw = process.env[envKey];
  if (!raw?.trim()) return fallback;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
