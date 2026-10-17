import { canonicalItemCategory } from "@/lib/ecommerce/category-match";

export function buildVisualSearchQuery(params: {
  description?: string;
  category?: string;
  caption?: string;
  tags?: string[];
  extraQuery?: string;
}): string {
  const category = params.category
    ? canonicalItemCategory(params.category)
    : "";
  const parts = [
    params.extraQuery,
    params.description,
    params.caption,
    category && category !== "garment" ? category : "",
    ...(params.tags ?? []).slice(0, 4),
  ]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
