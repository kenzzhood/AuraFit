import { readDiscoveryFlags } from "@/lib/flags";
import { classifyFashionAesthetic } from "./aesthetic";

export type SlotMatchOptions = {
  genderPresentation?: string;
  /** User text. Negative filters stay off when this asks for them. */
  requestedText?: string;
};

type ExplicitAudience = "women" | "men" | "unisex";

function explicitAudience(genderPresentation?: string): ExplicitAudience | null {
  const g = (genderPresentation ?? "").toLowerCase();
  if (!g.trim()) return null;
  if (/(woman|women|female|feminine|girl|ladies)/.test(g)) return "women";
  if (/(man|men|male|masculine|boy|gentlemen)/.test(g)) return "men";
  if (/(nonbinary|non-binary|neutral|unisex|androgynous)/.test(g)) return "unisex";
  return null;
}

/** Shared slot normalization — keep in sync with generation.ts / LookDetailPanel. */
export function canonicalItemCategory(raw: string | undefined): string {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s) return "garment";
  // Dress/wrap tokens in a shirt title are still tops.
  if (/(dress\s+shirt|wrap\s+shirt)/.test(s)) return "top";
  // Mini/midi/maxi skirt is a bottom, not a dress.
  if (/\bskirt\b/.test(s) && !/\bdress\b/.test(s)) return "bottom";
  if (/(jacket|blazer|coat|outer|overcoat|trench|overshirt|shacket|cardigan)/.test(s))
    return "outerwear";

  const clearlyOtherSlot =
    /(jean|trouser|pant|chino|\bshorts?\b|bottom|cargo)/.test(s) ||
    /(tee|t-?shirt|blouse|polo|knit|sweater|hoodie|\bshirt\b)/.test(s) ||
    /(shoe|sneaker|loafer|boot|footwear|sandal|heel)/.test(s) ||
    /(watch|belt|bag|clutch|purse|hat|cap|sunglass|accessor|scarf|jewel|earring|necklace|bracelet|tie|sock)/.test(
      s
    );

  if (!clearlyOtherSlot && /\b(midi|maxi|mini|bodycon|a-line|aline|wrap)\b/.test(s)) {
    return "dress";
  }

  if (/(dress|gown|jumpsuit|romper|saree|sari|kurta|lehenga)/.test(s)) return "dress";
  if (/(shirt|tee|t-?shirt|top|blouse|polo|knit|sweater|hoodie)/.test(s)) return "top";
  if (/(jean|trouser|pant|chino|short|bottom|skirt|cargo)/.test(s)) return "bottom";
  if (/(shoe|sneaker|loafer|boot|footwear|sandal|heel)/.test(s)) return "shoes";
  if (
    /(watch|belt|bag|clutch|purse|hat|cap|sunglass|accessor|scarf|jewel|earring|necklace|bracelet|tie|sock)/.test(
      s
    )
  )
    return "accessory";
  return s;
}

const PRIMARY_SLOTS = new Set([
  "top",
  "bottom",
  "outerwear",
  "dress",
  "shoes",
  "accessory",
]);

/**
 * Returns true when a product title/metadata plausibly belongs in the requested
 * outfit slot. Prevents index/cache hits like "Navy Chinos" from filling "top".
 */
export function productMatchesSlot(
  title: string,
  productCategory: string | undefined,
  slotCategory: string,
  options?: SlotMatchOptions
): boolean {
  const slot = canonicalItemCategory(slotCategory);
  const fromTitle = canonicalItemCategory(title);
  const fromMeta = productCategory
    ? canonicalItemCategory(productCategory)
    : "garment";

  const titleLower = title.toLowerCase();

  if (readDiscoveryFlags().slotQueryMode === "v2") {
    const asked = (options?.requestedText ?? "").toLowerCase();
    if (!asked.includes("kid") && /\bkids?\b/.test(titleLower)) return false;
    if (!asked.includes("pack of") && /\bpack of\b/.test(titleLower)) return false;
    if (!asked.includes("unstitched") && /\bunstitched\b/.test(titleLower)) return false;
    if (
      slot === "dress" &&
      /\bkurta\b/.test(titleLower) &&
      explicitAudience(options?.genderPresentation) !== "men"
    ) {
      return false;
    }
  }

  if (slot === "top") {
    if (/(chino|trouser|trousers|pant|pants|jean|jeans|shorts|skirt|cargo pant)/.test(titleLower))
      return false;
    if (fromTitle === "top") return true;
    if (/(polo|shirt|tee|t-shirt|blouse|sweater|knit|henley|oxford)/.test(titleLower))
      return true;
    return fromMeta === "top";
  }

  if (slot === "bottom") {
    if (/(polo|shirt|tee|t-shirt|blouse|sweater|hoodie|jacket|blazer|coat)/.test(titleLower))
      return false;
    if (fromTitle === "bottom") return true;
    if (/(chino|trouser|trousers|pant|pants|jean|jeans|shorts|skirt|cargo)/.test(titleLower))
      return true;
    return fromMeta === "bottom";
  }

  if (slot === "outerwear") {
    if (/(chino|trouser|trousers|pant|pants|jean|jeans|shorts|skirt)/.test(titleLower))
      return false;
    if (fromTitle === "outerwear") return true;
    if (/(jacket|blazer|coat|overshirt|shacket|overcoat|trench|gilet|vest)/.test(titleLower))
      return true;
    return fromMeta === "outerwear";
  }

  if (slot === "dress") {
    if (PRIMARY_SLOTS.has(fromTitle) && fromTitle !== "dress") return false;
    if (fromTitle === "dress") return true;
    if (/(dress|gown|jumpsuit|romper|saree|sari|kurta|lehenga)/.test(titleLower))
      return true;
    return fromMeta === "dress";
  }

  if (slot === "shoes") {
    if (fromTitle === "shoes") return true;
    if (/(shoe|sneaker|loafer|boot|sandal|heel|footwear|trainer)/.test(titleLower))
      return true;
    return fromMeta === "shoes";
  }

  if (slot === "accessory") {
    if (fromTitle === "accessory") return true;
    if (
      /(belt|watch|bag|clutch|purse|hat|cap|sunglass|scarf|tie|sock|wallet|bracelet|necklace|earring)/.test(
        titleLower
      )
    )
      return true;
    return fromMeta === "accessory";
  }

  if (PRIMARY_SLOTS.has(fromTitle) && PRIMARY_SLOTS.has(slot) && fromTitle !== slot) {
    return false;
  }

  return fromTitle === slot || fromMeta === slot;
}

/** Strengthen per-slot retailer queries when the LLM phrase is outfit-level. */
export function slotSearchQuery(
  base: string,
  category: string,
  style?: string
): string {
  const trimmed = base.trim();
  const slot = canonicalItemCategory(category);
  const styleBit = style?.trim() ?? "";

  const hints: Record<string, string> = {
    top: "shirt",
    bottom: "trousers",
    outerwear: "jacket",
    shoes: "shoes",
    dress: "dress",
    accessory: "accessory",
  };
  const hint = hints[slot];
  if (!hint) return `${trimmed} ${styleBit}`.trim();

  const hay = trimmed.toLowerCase();
  const alreadySpecific =
    slot === "top"
      ? /(shirt|polo|tee|blouse|sweater|knit|top)/.test(hay)
      : slot === "bottom"
        ? /(trouser|pant|chino|jean|short|skirt)/.test(hay)
        : slot === "outerwear"
          ? /(jacket|blazer|coat|overshirt|shacket)/.test(hay)
          : slot === "shoes"
            ? /(shoe|sneaker|loafer|boot|sandal)/.test(hay)
            : hint.split(/\s+/).some((w) => hay.includes(w));

  if (alreadySpecific) return `${trimmed} ${styleBit}`.trim();
  return `${trimmed} ${hint} ${styleBit}`.trim();
}

/** Broad retailer queries used when planned searches miss verified inventory. */
export function audienceFromGender(
  genderPresentation?: string,
  region: "IN" | "US" | "UK" = "IN"
): string {
  const explicit = explicitAudience(genderPresentation);
  if (explicit) return explicit;
  if (readDiscoveryFlags().requireGender) return "unisex";
  return region === "US" ? "men" : region === "UK" ? "men" : "men";
}

function dressSlotQueries(
  audience: string,
  styleBit: string,
  genderPresentation?: string
): string[] {
  const v2 = readDiscoveryFlags().slotQueryMode === "v2";
  const explicitMen = explicitAudience(genderPresentation) === "men";
  const asKurta = v2 ? explicitMen : audience === "men";
  if (asKurta) return [`${styleBit} kurta`, `${styleBit} ethnic wear`];
  if (audience === "unisex") {
    return ["casual dress", "midi dress", "office dress"];
  }
  return [
    `${audience} casual dress`,
    `${audience} midi dress`,
    `${audience} office dress`,
  ];
}

function uniqueTrimmed(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function casualSmartQueries(
  slot: string,
  styleBit: string,
  audience: string,
  genderPresentation?: string
): string[] | null {
  switch (slot) {
    case "top":
      return [
        `${styleBit} polo shirt`,
        `${styleBit} casual shirt`,
        `${styleBit} cotton tshirt`,
        `${styleBit} formal shirt`,
      ];
    case "bottom":
      return [
        `${styleBit} chinos`,
        `${styleBit} trousers`,
        `${styleBit} formal pants`,
        `${styleBit} slim fit pants`,
      ];
    case "outerwear":
      return [
        `${styleBit} overshirt`,
        `${styleBit} casual blazer`,
        `${styleBit} lightweight jacket`,
      ];
    case "dress":
      return dressSlotQueries(audience, styleBit, genderPresentation);
    case "shoes":
      return [
        `${styleBit} casual shoes`,
        `${styleBit} sneakers`,
        `${styleBit} loafers`,
      ];
    case "accessory":
      return [`${styleBit} leather belt`, `${styleBit} casual watch`];
    default:
      return null;
  }
}

export function genericSlotQueries(
  category: string,
  style?: string,
  region: "IN" | "US" | "UK" = "IN",
  genderPresentation?: string
): string[] {
  const slot = canonicalItemCategory(category);
  const audience = audienceFromGender(genderPresentation, region);
  const styleBit = style?.trim() || audience;
  const aesthetic = classifyFashionAesthetic(style ?? "");
  const women = audience === "women";

  if (aesthetic === "casual" || aesthetic === "smart") {
    return (
      casualSmartQueries(slot, styleBit, audience, genderPresentation) ?? [
        `${styleBit} ${slot}`,
      ]
    );
  }

  if (aesthetic === "old_money") {
    switch (slot) {
      case "top":
        return women
          ? [
              `linen blouse ${audience}`,
              `linen shirt ${audience}`,
              `silk blouse ${audience}`,
            ]
          : [
              `linen oxford shirt ${audience}`,
              `cream linen shirt ${audience}`,
              `striped oxford shirt ${audience}`,
            ];
      case "bottom":
        return [
          `wool pleated trousers ${audience}`,
          `pleated trousers ${audience}`,
          `wool trousers ${audience}`,
        ];
      case "outerwear":
        return [
          `tailored linen blazer ${audience}`,
          `navy wool blazer ${audience}`,
          `linen blazer ${audience}`,
        ];
      case "shoes":
        return [
          `leather loafers ${audience}`,
          `penny loafers ${audience}`,
          `suede loafers ${audience}`,
        ];
      default:
        break;
    }
  }

  if (aesthetic === "dressy") {
    switch (slot) {
      case "top":
        return women
          ? [
              `dress blouse ${audience}`,
              `silk shirt ${audience}`,
              `dress shirt ${audience}`,
            ]
          : [
              `dress shirt ${audience}`,
              `white dress shirt ${audience}`,
              `black dress shirt ${audience}`,
            ];
      case "bottom":
        return [
          `tailored trousers ${audience}`,
          `slim tailored trousers ${audience}`,
          `charcoal tailored trousers ${audience}`,
        ];
      case "outerwear":
        return [
          `tailored blazer ${audience}`,
          `navy tailored blazer ${audience}`,
          `black tailored blazer ${audience}`,
        ];
      case "shoes":
        return [
          `leather loafers ${audience}`,
          `dress shoes ${audience}`,
          `loafers ${audience}`,
        ];
      default:
        break;
    }
  }

  if (aesthetic === "formal") {
    switch (slot) {
      case "top":
        return women
          ? [
              `formal blouse ${audience}`,
              `dress shirt ${audience}`,
              `white formal blouse ${audience}`,
            ]
          : [
              `formal shirt ${audience}`,
              `white dress shirt ${audience}`,
              `formal dress shirt ${audience}`,
            ];
      case "bottom":
        return [
          `formal trousers ${audience}`,
          `navy formal trousers ${audience}`,
          `charcoal formal trousers ${audience}`,
        ];
      case "outerwear":
        return [
          `suit jacket ${audience}`,
          `tailored blazer ${audience}`,
          `navy suit jacket ${audience}`,
        ];
      case "shoes":
        return women
          ? [
              `leather loafers ${audience}`,
              `loafers ${audience}`,
              `dress shoes ${audience}`,
            ]
          : [
              `leather oxfords ${audience}`,
              `oxford shoes ${audience}`,
              `cap toe oxfords ${audience}`,
            ];
      default:
        break;
    }
  }

  if (aesthetic === "street") {
    switch (slot) {
      case "top":
        return [
          `graphic tee ${audience}`,
          `hoodie ${audience}`,
          `cotton tshirt ${audience}`,
        ];
      case "bottom":
        return [
          `relaxed jeans ${audience}`,
          `cargo pants ${audience}`,
          `baggy jeans ${audience}`,
        ];
      case "outerwear":
        return [
          `bomber jacket ${audience}`,
          `nylon bomber ${audience}`,
          `oversized bomber ${audience}`,
        ];
      case "shoes":
        return [
          `sneakers ${audience}`,
          `white sneakers ${audience}`,
          `chunky sneakers ${audience}`,
        ];
      default:
        break;
    }
  }

  if (aesthetic === "ethnic") {
    switch (slot) {
      case "top":
        return [
          `kurta ${audience}`,
          `linen shirt ${audience}`,
          `cotton kurta ${audience}`,
        ];
      case "bottom":
        return [
          `straight trousers ${audience}`,
          `churidar trousers ${audience}`,
          `linen trousers ${audience}`,
        ];
      case "outerwear":
        return [
          `nehru jacket ${audience}`,
          `bandhgala jacket ${audience}`,
          `linen jacket ${audience}`,
        ];
      case "shoes":
        return [
          `leather loafers ${audience}`,
          `loafers ${audience}`,
          `mojari loafers ${audience}`,
        ];
      default:
        break;
    }
  }

  const dressFallback =
    slot === "dress"
      ? dressSlotQueries(audience, styleBit, genderPresentation)
      : null;
  if (dressFallback) return dressFallback;
  if (slot === "accessory") {
    return [`${audience} leather belt`, `${audience} casual watch`];
  }
  return [`${audience} ${slot}`];
}

export function slotSearchVariants(params: {
  category: string;
  searchQuery?: string;
  description?: string;
  style?: string;
  region?: "IN" | "US" | "UK";
  genderPresentation?: string;
  maxAttempts?: number;
  /** Online looks: one broad slot query, then the planned garment name. */
  broadFirst?: boolean;
  occasion?: string;
  silhouette?: string;
  color?: string;
  fabric?: string;
  budgetLabel?: string;
  wardrobeHint?: string;
}): string[] {
  const generics = genericSlotQueries(
    params.category,
    params.style,
    params.region ?? "IN",
    params.genderPresentation
  );
  if (readDiscoveryFlags().slotQueryMode !== "v2") {
    const maxAttempts = params.maxAttempts ?? 2;
    const ordered = params.broadFirst
      ? [generics[0], params.searchQuery, params.description, ...generics.slice(1)]
      : [params.searchQuery, params.description, ...generics];
    return uniqueTrimmed(ordered).slice(0, maxAttempts);
  }

  const slot = canonicalItemCategory(params.category);
  const broad = generics[0];
  const occasion = [params.occasion, params.silhouette ?? params.style, slot]
    .filter(Boolean)
    .join(" ");
  const colorFabric = [params.color, params.fabric, params.searchQuery]
    .filter(Boolean)
    .join(" ");
  const budget =
    params.budgetLabel && params.searchQuery
      ? `${params.searchQuery} ${params.budgetLabel}`
      : params.budgetLabel
        ? `${params.budgetLabel} ${slot}`
        : undefined;
  const wardrobe = params.wardrobeHint
    ? `${params.searchQuery ?? slot} pairs with ${params.wardrobeHint}`
    : undefined;
  return uniqueTrimmed([
    params.searchQuery,
    params.description,
    occasion,
    colorFabric,
    budget,
    wardrobe,
    ...generics.slice(1),
    broad,
  ]).slice(0, 6);
}
