import { prisma } from "@/lib/prisma";
import { embedText } from "@/lib/ai/embeddings";

export type StylistContext = {
  wardrobeSummary: string;
  recentOutfitsSummary: string;
  stylePrefsSummary: string;
};

export async function buildStylistContext(
  userId: string,
  userMessage?: string
): Promise<StylistContext> {
  const [wardrobeItems, outfits, prefs] = await Promise.all([
    fetchRelevantWardrobe(userId, userMessage),
    prisma.outfit.findMany({
      where: { userId, isSaved: true },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        name: true,
        occasion: true,
        styleNotes: true,
      },
    }),
    prisma.stylePreference.findUnique({
      where: { userId },
      select: {
        aesthetics: true,
        colors: true,
        brands: true,
        budgetMin: true,
        budgetMax: true,
        region: true,
        currency: true,
      },
    }),
  ]);

  const wardrobeSummary =
    wardrobeItems.length === 0
      ? "No wardrobe items uploaded yet."
      : wardrobeItems
          .map((w) => {
            const tags =
              w.tags && typeof w.tags === "object"
                ? JSON.stringify(w.tags).slice(0, 80)
                : "";
            return `- ${w.category}${w.brand ? ` (${w.brand})` : ""}${w.notes ? `: ${w.notes}` : ""}${tags ? ` [${tags}]` : ""}`;
          })
          .join("\n");

  const recentOutfitsSummary =
    outfits.length === 0
      ? "No saved looks yet."
      : outfits
          .map(
            (o) =>
              `- ${o.name ?? "Saved look"}${o.occasion ? ` · ${o.occasion}` : ""}`
          )
          .join("\n");

  const prefParts: string[] = [];
  if (prefs?.aesthetics) prefParts.push(`Aesthetics: ${JSON.stringify(prefs.aesthetics)}`);
  if (prefs?.colors) prefParts.push(`Colors: ${JSON.stringify(prefs.colors)}`);
  if (prefs?.brands) prefParts.push(`Brands: ${JSON.stringify(prefs.brands)}`);
  if (prefs?.budgetMin != null || prefs?.budgetMax != null) {
    prefParts.push(
      `Budget: ${prefs.currency ?? "INR"} ${prefs.budgetMin ?? "?"}–${prefs.budgetMax ?? "?"}`
    );
  }
  if (prefs?.region) prefParts.push(`Region: ${prefs.region}`);

  return {
    wardrobeSummary,
    recentOutfitsSummary,
    stylePrefsSummary: prefParts.length
      ? prefParts.join("\n")
      : "No onboarding preferences saved yet.",
  };
}

async function fetchRelevantWardrobe(userId: string, userMessage?: string) {
  const baseSelect = {
    id: true,
    category: true,
    brand: true,
    notes: true,
    tags: true,
    colors: true,
    styleLabels: true,
  } as const;

  if (userMessage?.trim()) {
    try {
      const vec = await embedText(userMessage.slice(0, 2000));
      const literal = `[${vec.join(",")}]`;
      const rows = await prisma.$queryRawUnsafe<
        Array<{
          id: string;
          category: string;
          brand: string | null;
          notes: string | null;
          tags: unknown;
        }>
      >(
        `SELECT wi."id", wi."category", wi."brand", wi."notes", wi."tags"
         FROM "WardrobeItem" wi
         JOIN "Wardrobe" w ON w."id" = wi."wardrobeId"
         JOIN "FashionEmbedding" fe ON fe."wardrobeItemId" = wi."id"
         WHERE w."userId" = $2::text
         ORDER BY fe."embedding" <=> $1::vector
         LIMIT 12`,
        literal,
        userId
      );
      if (rows.length) return rows;
    } catch {
      /* fall through to recent items */
    }
  }

  return prisma.wardrobeItem.findMany({
    where: { wardrobe: { userId } },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: baseSelect,
  });
}

export function formatStylistContextBlock(ctx: StylistContext): string {
  return `## User context (use this — do not say retrieval is unwired)

### Style preferences
${ctx.stylePrefsSummary}

### Wardrobe (relevant pieces)
${ctx.wardrobeSummary}

### Recent saved looks
${ctx.recentOutfitsSummary}

### Actions you can take in this chat
- Generate 2–3 shoppable look boards here with generate_looks (uses a look credit). Never send the user to /generate for a look they asked in chat.
- Swap a garment slot on a chat look with replace_slot, then re-render the board.
- Find closest shoppable matches from a garment photo with visual_search.
- Search verified products with search_products. Only share shop URLs tools return.`;
}
