import { getChatClient, getEmbeddingClient } from "@/lib/azure/openai";
import { joinShoppingStyle } from "@/lib/ecommerce/aesthetic";
import { sanitizeRetailerSites } from "@/lib/ecommerce/sites/dynamic-retailers";
import type { PlannedLook, PersonAnalysis } from "@/types/generation";
import type {
  AIProvider,
  AnalyzePersonInput,
  ChatMessageInput,
  GenerateLooksInput,
  GenerateLooksResult,
} from "./types";

const ANALYSIS_SYSTEM = `You are an elite AI fashion stylist, celebrity image consultant, and hyper-realistic visual identity analyst.

Analyze the uploaded photo with extreme precision. Your output will be used to generate photorealistic images that must preserve this person's identity 100% across 6 fashion panels. Every detail you capture will be used to lock their face and body into the image generation model.

Reply with JSON only matching this schema — be as specific and descriptive as possible for EVERY field:
{
  "genderPresentation": string,
  "ageRange": string,
  "skinTone": string,                     // e.g. "warm medium-brown South Asian complexion"
  "undertones": string,                   // e.g. "warm golden-olive undertones"
  "faceShape": string,                    // e.g. "refined oval face with slightly angular jaw"
  "hairType": string,                     // e.g. "thick dark wavy hair"
  "hairColor": string,                    // e.g. "natural dark brown-black"
  "hairstyle": string,                    // e.g. "medium length, naturally wavy, slight volume on top"
  "eyeDescription": string,               // e.g. "dark deep-set eyes with thick eyebrows"
  "skinTextureNotes": string,             // e.g. "natural skin with visible pores, slight texture, no blemish — real, not retouched"
  "faceAnatomyNotes": string,             // e.g. "strong straight nose, defined cheekbones, slim jawline, soft lips"
  "distinctiveFeatures": string,          // e.g. "rectangular glasses with thin dark frame, clean beard stubble"
  "bodyBuild": string,
  "heightEstimate": string,
  "shoulderWidth": string,
  "currentStyle": string,
  "personalVibe": string,
  "bestSilhouettes": string[],
  "bestColors": string[],
  "identityNotes": string                 // Full paragraph: describe this person as if briefing a photographer who has never met them
}`;

// Categories the look planner is allowed to use. Anything else gets coerced
// to "top" so we never end up with the literal word "item" rendering in the UI
// or leaking into search queries.
const VALID_CATEGORIES = new Set([
  "top",
  "bottom",
  "outerwear",
  "shoes",
  "accessories",
  "bag",
  "watch",
  "belt",
  "sunglasses",
  "dress",
]);

export function normalizeCategory(raw: string | undefined): string {
  const c = (raw ?? "").toLowerCase().trim();
  if (VALID_CATEGORIES.has(c)) return c;
  // Dress/wrap tokens in a shirt are still tops.
  if (/(dress\s+shirt|wrap\s+shirt)/.test(c)) return "top";
  if (
    /(midi|maxi|gown|jumpsuit|romper|saree|sari|lehenga|bodycon|kurta|dress)/.test(
      c
    )
  ) {
    return "dress";
  }
  if (/(jean|trouser|pant|chino|short)/.test(c)) return "bottom";
  if (/(shirt|tee|tshirt|polo|blouse)/.test(c)) return "top";
  if (/(blazer|jacket|coat|hoodie|sweater)/.test(c)) return "outerwear";
  if (/(shoe|sneaker|loafer|boot|sandal)/.test(c)) return "shoes";
  return "top";
}

/** When the LLM omitted searchQuery — description + category, never a hardcoded gender. */
export function fallbackItemSearchQuery(
  description: string,
  category: string
): string {
  return [description, category].filter(Boolean).join(" ");
}

/** Chat uses 2 or 3; /generate defaults to 6 when unset. */
export function resolveLookCount(input?: { lookCount?: number }): 2 | 3 | 6 {
  if (input?.lookCount === 2 || input?.lookCount === 3 || input?.lookCount === 6) {
    return input.lookCount;
  }
  return 6;
}

export function padLooksToCount<T extends { label?: string }>(
  plan: T[],
  lookCount: number
): T[] {
  if (!plan.length) return plan;
  const out = [...plan];
  while (out.length < lookCount) {
    out.push({
      ...out[out.length - 1]!,
      label: `Look ${out.length + 1}`,
    });
  }
  return out.slice(0, lookCount);
}

export function lookPlannerSystemPrompt(
  lookCount: number,
  wardrobeRules?: string
): string {
  return `You are a senior luxury fashion stylist. Output JSON only — no prose, no markdown — exactly matching this schema:

{
  "retailerSites": [
    {"name": "Nordstrom", "domain": "nordstrom.com", "searchUrlTemplate": "https://www.nordstrom.com/sr?keyword={query}"},
    {"name": "ASOS", "domain": "asos.com", "searchUrlTemplate": "https://www.asos.com/search/?q={query}"}
  ],
  "looks": [
    {
      "label": "Office Power Move",                          // 2-4 word evocative name
      "tagline": "Sharp boardroom statement",                // 3-6 word vibe
      "description": "Tailored navy blazer over a crisp white shirt with charcoal trousers and brown loafers, finished with a slim leather belt and minimalist watch.",
      "bestFor": "Morning meetings or client lunches",
      "priceRange": "₹6,000–₹12,000",
      "productSearchQuery": "navy tailored blazer charcoal trousers white shirt",
      "items": [
        {"category": "outerwear", "description": "Slim-fit navy wool blazer", "searchQuery": "navy slim fit blazer men", "wardrobeItemId": "<closet id when applicable>"},
        {"category": "top",       "description": "Crisp white cotton dress shirt", "searchQuery": "white cotton dress shirt men"},
        {"category": "bottom",    "description": "Charcoal slim trousers", "searchQuery": "charcoal slim trousers men"},
        {"category": "shoes",     "description": "Brown leather loafers", "searchQuery": "brown leather loafers men"},
        {"category": "accessories","description": "Black slim leather belt", "searchQuery": "black slim leather belt men"}
      ]
    }
  ]
}

HARD RULES — non-negotiable:
1. Return EXACTLY ${lookCount} looks, each visually and stylistically distinct.
2. Every item.category MUST be one of: "top", "bottom", "outerwear", "shoes", "accessories", "bag", "watch", "belt", "sunglasses", "dress". Never the literal word "item".
3. Every item.searchQuery MUST be a concrete, shoppable phrase (e.g. "navy slim fit blazer men", "white leather sneakers men") — 3-7 words, no placeholders.
4. Every item.description MUST be a specific garment description with colour + fabric/cut (e.g. "tailored charcoal wool trousers"). NEVER use the bare category enum ("TOP", "BOTTOM", "OTHER", "SHOES"). NEVER copy a wardrobe id. Minimum 4 words.
5. Each look has 3-5 items covering at minimum top + bottom + shoes.
6. productSearchQuery is a single phrase that summarises the whole look for shopping.
7. wardrobeItemId is OPTIONAL by default — only emit it when the wardrobeContext rules below say to. Never invent ids.
8. Tailor everything to the user's personAnalysis, occasion, location, budget, and style preferences provided in the user message.
9. retailerSites: return EXACTLY 18–22 real, currently-operating fashion e-commerce websites appropriate for the user's location (country/region), occasion, and style. Mix mainstream marketplaces with niche/boutique brands that match the aesthetic. Each entry MUST have: name (store display name), domain (registrable domain only, no path), searchUrlTemplate (full https URL with {query} as the search-term placeholder — verify the pattern is realistic for that site). Optional engine: "httpx" only for JSON/API search endpoints; default "playwright" for HTML sites. Optional priority 1–5 (lower = search first). Do NOT repeat the same domain twice.
10. Every look must match the user's styleType, occasion, and preferences. Do not convert them to generic smart-casual.
11. Do not repeat the same silhouette across looks (polo/tee + chinos, white shirt + chinos).
12. When formality warrants it (old money, office party, cocktail, partywear, formal, black tie): every look includes outerwear (blazer / sport coat / tailored jacket).
13. old money ≠ weekend chinos/polo; office party ≠ polo+chinos.${wardrobeRules ?? ""}`;
}

function parseLooksResponse(raw: string): GenerateLooksResult | null {
  try {
    const parsed = JSON.parse(raw) as {
      looks?: Array<{
        productSearchQuery?: string;
        label?: string;
        tagline?: string;
        description?: string;
        bestFor?: string;
        priceRange?: string;
        items?: Array<{
          category?: string;
          description?: string;
          searchQuery?: string;
          wardrobeItemId?: string;
        }>;
      }>;
      retailerSites?: Array<{
        name?: string;
        domain?: string;
        searchUrlTemplate?: string;
        engine?: string;
        priority?: number;
      }>;
    };
    if (!Array.isArray(parsed.looks)) return null;
    const plan: PlannedLook[] = parsed.looks.map((l, i) => {
      const lookQuery =
        String(l.productSearchQuery ?? "").trim() || `look ${i + 1}`;
      const items = Array.isArray(l.items)
        ? l.items.map((it) => {
            const category = normalizeCategory(it.category);
            const description = String(it.description ?? "").trim();
            // If the LLM omitted searchQuery (or gave whitespace), build a real
            // one out of description+category+look query so we never end up
            // sending placeholder queries like "item " to the crawler.
            const rawSearch = String(it.searchQuery ?? "").trim();
            const searchQuery =
              rawSearch ||
              fallbackItemSearchQuery(description, category).trim() ||
              lookQuery;
            const rawWardrobeId = String(it.wardrobeItemId ?? "").trim();
            return {
              category,
              description:
                description || `${category} piece for the look`,
              searchQuery,
              ...(rawWardrobeId ? { wardrobeItemId: rawWardrobeId } : {}),
            };
          })
        : undefined;
      return {
        productSearchQuery: lookQuery,
        label: l.label ? String(l.label) : `Look ${i + 1}`,
        tagline: l.tagline ? String(l.tagline) : undefined,
        description: l.description ? String(l.description) : undefined,
        bestFor: l.bestFor ? String(l.bestFor) : undefined,
        priceRange: l.priceRange ? String(l.priceRange) : undefined,
        items,
      };
    });
    const retailerSites = sanitizeRetailerSites(parsed.retailerSites);
    return { looks: plan, retailerSites };
  } catch {
    return null;
  }
}

export const azureAIProvider: AIProvider = {
  name: "azure",

  isConfigured() {
    return !!(
      process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY
    );
  },

  async analyzePerson({ imageUrl }: AnalyzePersonInput) {
    const client = getChatClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O ?? "gpt-4o";
    const completion = await client.chat.completions.create({
      model: deployment,
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this person for luxury personalized fashion styling.",
            },
            { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1200,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as PersonAnalysis;
  },

  async generateLooks(input: GenerateLooksInput) {
    const client = getChatClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O ?? "gpt-4o";
    const lookCount = resolveLookCount(input);
    const shoppingBrief = joinShoppingStyle({
      styleType: input.styleType,
      occasion: input.occasion,
      style: input.style,
    });
    const userBits = [
      `path=${input.path}`,
      `lookCount=${lookCount}`,
      shoppingBrief && `brief=${shoppingBrief}`,
      input.styleType && `styleType=${input.styleType}`,
      input.occasion && `occasion=${input.occasion}`,
      input.location && `location=${input.location}`,
      input.style && `preferences=${input.style}`,
      input.budgetMin != null && `budgetMin=${input.budgetMin}`,
      input.budgetMax != null && `budgetMax=${input.budgetMax}`,
      input.wardrobeSummary && `wardrobe=${input.wardrobeSummary}`,
      input.wardrobeContext &&
        `wardrobeContext=${JSON.stringify(input.wardrobeContext)}`,
      `personAnalysis=${JSON.stringify(input.personAnalysis ?? {})}`,
    ]
      .filter(Boolean)
      .join("\n");

    // Mode-specific rule block. Only injected when the orchestrator passes a
    // wardrobeContext, otherwise the prompt stays identical to the existing
    // online-only behaviour so we don't regress the default flow.
    const wardrobeRules = input.wardrobeContext
      ? input.wardrobeContext.mode === "mix"
        ? `

WARDROBE MIX MODE — every slot must come from the closet:
- A wardrobeContext with allowedItems[] and lockedByCategory{} is provided in the user message. allowedItems[].description is the catalogue-style description of that closet piece (e.g. "olive green cargo pants").
- For EVERY items[i] you output, you MUST set items[i].wardrobeItemId to the id of one of the allowedItems whose category matches items[i].category.
- For any category present as a key in lockedByCategory, you MUST only use ids listed there for that category. If the same key has 2+ ids, ROTATE them roughly evenly across the ${lookCount} looks.
- For categories NOT present in lockedByCategory, choose any allowedItem with the matching category. If no allowedItem matches a category, OMIT that slot from the look (do not invent one).
- For closet items: items[i].description MUST be a vivid styling sentence written in your own voice that takes the allowedItem.description as ground truth. Do NOT just echo the category enum like "TOP", "BOTTOM" or the allowedItem id. Keep colours and fabrics faithful to the allowedItem.description — never invent a colour that isn't in it.
  Example — allowedItem.description "white short-sleeve cotton tee" -> items[i].description "crisp white cotton tee, sleeves rolled to the elbow".
  Example — allowedItem.description "olive green cargo pants" -> items[i].description "relaxed olive cargo trousers cuffed at the ankle".
- For closet items, set items[i].searchQuery to the allowedItem.description verbatim (lowercase, no extra words). Do NOT invent generic shop queries — there is no online search in this mode.
- Each look should still feel cohesive; reorder/remix the same wardrobe pieces to give ${lookCount} visually distinct outfits.`
        : `

WARDROBE PAIR MODE — anchored pieces with online filler:
- A wardrobeContext with allowedItems[] (the anchors) and lockedByCategory{} is provided in the user message.
- For EVERY category present as a key in lockedByCategory, you MUST set items[i].wardrobeItemId to one of the listed ids in that category. If a key has 2+ ids, ROTATE them across the ${lookCount} looks.
- For all OTHER categories, do NOT set wardrobeItemId. Provide a normal shoppable searchQuery and description so the system can fetch real online products.
- Anchors are non-negotiable: never replace them with online items, and never duplicate the same anchor's category with a different searchQuery.
- Build the rest of each look so that the online pieces visibly pair with the anchors (matching tone, formality, season).`
      : "";

    const completion = await client.chat.completions.create({
      model: deployment,
      messages: [
        {
          role: "system",
          content: lookPlannerSystemPrompt(lookCount, wardrobeRules),
        },
        { role: "user", content: userBits },
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 4000,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error("No look plan from Azure");
    const parsed = parseLooksResponse(raw);
    if (!parsed?.looks.length) throw new Error("Invalid look plan");
    const plan = padLooksToCount(parsed.looks, lookCount);
    return {
      looks: plan,
      retailerSites: parsed.retailerSites,
    };
  },

  async *generateChat(messages: ChatMessageInput[]) {
    const client = getChatClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O ?? "gpt-4o";
    const stream = await client.chat.completions.create({
      model: deployment,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      stream: true,
      max_tokens: 1024,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  },

  async generateEmbeddings(text: string) {
    const client = getEmbeddingClient();
    const deployment =
      process.env.AZURE_OPENAI_DEPLOYMENT_EMBED ?? "text-embedding-3-large";
    const res = await client.embeddings.create({
      model: deployment,
      input: text,
    });
    return res.data[0]?.embedding ?? [];
  },

};
