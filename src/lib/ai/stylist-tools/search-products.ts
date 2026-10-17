import { discoverProducts, locationToRegion } from "@/lib/ecommerce/discovery";
import { canonicalItemCategory } from "@/lib/ecommerce/category-match";
import { prisma } from "@/lib/prisma";
import { shoppableProductCards } from "./products";
import type { StylistToolContext, StylistToolResult } from "./types";

export async function handleSearchProducts(
  ctx: StylistToolContext,
  args: Record<string, unknown>
): Promise<StylistToolResult> {
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) {
    return { ok: false, message: "search_products requires a query." };
  }
  const category =
    typeof args.category === "string"
      ? canonicalItemCategory(args.category)
      : "top";
  const budgetMax =
    typeof args.budgetMax === "number" ? args.budgetMax : undefined;

  const prefs = await prisma.stylePreference.findUnique({
    where: { userId: ctx.userId },
    select: { region: true },
  });
  const region = locationToRegion(prefs?.region);

  const discovered = await discoverProducts({
    query: {
      query,
      category: category === "garment" ? "top" : category,
      region,
      budgetMax,
    },
    userId: ctx.userId,
  });

  const products = shoppableProductCards(discovered.products, {
    max: 8,
    matchCategory: category === "garment" ? undefined : category,
  });

  if (!products.length) {
    return {
      ok: false,
      message: `No verified shoppable products found for "${query}". Try a more specific garment name.`,
    };
  }

  return {
    ok: true,
    products,
    message: `Found ${products.length} verified shoppable products for "${query}". Only share these URLs — never invent links.`,
  };
}
