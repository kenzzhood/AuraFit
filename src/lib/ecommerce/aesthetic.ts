export type FashionAesthetic =
  | "casual"
  | "smart"
  | "dressy"
  | "old_money"
  | "street"
  | "ethnic"
  | "formal";

function hasFashionToken(hay: string, token: string): boolean {
  const escaped = token
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "[\\s-]+");
  if (!token.includes(" ")) {
    return new RegExp(`\\b${escaped}\\b`, "i").test(hay);
  }
  return new RegExp(escaped, "i").test(hay);
}

/** First match wins. Check “office party” (dressy) before bare “office” (smart). */
export function classifyFashionAesthetic(text: string): FashionAesthetic {
  const t = text.toLowerCase();

  if (
    hasFashionToken(t, "old money") ||
    hasFashionToken(t, "quiet luxury") ||
    hasFashionToken(t, "stealth wealth") ||
    hasFashionToken(t, "luxury casual")
  ) {
    return "old_money";
  }

  if (
    hasFashionToken(t, "black tie") ||
    hasFashionToken(t, "white tie") ||
    hasFashionToken(t, "business formal") ||
    (hasFashionToken(t, "formal") && !hasFashionToken(t, "semi-formal") && !hasFashionToken(t, "semi formal"))
  ) {
    return "formal";
  }

  if (
    hasFashionToken(t, "ethnic") ||
    hasFashionToken(t, "saree") ||
    hasFashionToken(t, "sari") ||
    hasFashionToken(t, "lehenga") ||
    hasFashionToken(t, "kurta")
  ) {
    return "ethnic";
  }

  if (
    hasFashionToken(t, "office party") ||
    hasFashionToken(t, "cocktail") ||
    hasFashionToken(t, "partywear") ||
    hasFashionToken(t, "party") ||
    hasFashionToken(t, "gala") ||
    hasFashionToken(t, "club") ||
    hasFashionToken(t, "reception")
  ) {
    return "dressy";
  }

  if (hasFashionToken(t, "streetwear") || hasFashionToken(t, "street style")) {
    return "street";
  }

  if (
    hasFashionToken(t, "smart casual") ||
    hasFashionToken(t, "business casual") ||
    hasFashionToken(t, "semi-formal") ||
    hasFashionToken(t, "semi formal") ||
    hasFashionToken(t, "business") ||
    hasFashionToken(t, "office") ||
    hasFashionToken(t, "smart")
  ) {
    return "smart";
  }

  if (
    hasFashionToken(t, "casual") ||
    hasFashionToken(t, "weekend") ||
    hasFashionToken(t, "everyday")
  ) {
    return "casual";
  }

  return "smart";
}

export function aestheticNeedsOuterwear(a: FashionAesthetic): boolean {
  return a === "dressy" || a === "old_money" || a === "formal";
}

export function joinShoppingStyle(parts: {
  styleType?: string;
  occasion?: string;
  style?: string;
}): string {
  const seenExact = new Set<string>();
  const seenTokens = new Set<string>();
  const unique: string[] = [];
  for (const raw of [parts.styleType, parts.occasion, parts.style]) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seenExact.has(key)) continue;
    const tokens = key.split(/\s+/).filter(Boolean);
    // Skip a later part that only repeats tokens already joined
    // (chat may pre-join styleType+occasion into style).
    if (tokens.length > 0 && tokens.every((t) => seenTokens.has(t))) continue;
    seenExact.add(key);
    for (const t of tokens) seenTokens.add(t);
    unique.push(value);
  }
  return unique.join(" ");
}

export type FallbackLookItem = {
  category: string;
  description: string;
  searchQuery: string;
};

function item(searchQuery: string, category: string): FallbackLookItem {
  return { category, description: searchQuery, searchQuery };
}

function rotate<T>(rows: T[][], index: number): T[] {
  return rows[index % rows.length]!;
}

/** Aesthetic-varied slot lists for LLM-failure fallbacks. */
export function fallbackLookItems(
  aesthetic: FashionAesthetic,
  audience: string,
  index: number
): FallbackLookItem[] {
  const a = audience === "women" ? "women" : audience === "unisex" ? "unisex" : "men";
  const women = a === "women";

  if (aesthetic === "old_money") {
    return rotate(
      women
        ? [
            [
              item(`tailored linen blazer ${a}`, "outerwear"),
              item(`linen shirt ${a}`, "top"),
              item(`pleated trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
            [
              item(`navy wool blazer ${a}`, "outerwear"),
              item(`silk blouse ${a}`, "top"),
              item(`wool trousers ${a}`, "bottom"),
              item(`suede loafers ${a}`, "shoes"),
            ],
            [
              item(`cream linen blazer ${a}`, "outerwear"),
              item(`oxford shirt ${a}`, "top"),
              item(`wide pleated trousers ${a}`, "bottom"),
              item(`penny loafers ${a}`, "shoes"),
            ],
            [
              item(`tailored blazer ${a}`, "outerwear"),
              item(`linen blouse ${a}`, "top"),
              item(`tailored wool trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
            [
              item(`cashmere blazer ${a}`, "outerwear"),
              item(`cream linen shirt ${a}`, "top"),
              item(`pleated trousers ${a}`, "bottom"),
              item(`bit loafers ${a}`, "shoes"),
            ],
            [
              item(`unstructured linen blazer ${a}`, "outerwear"),
              item(`striped shirt ${a}`, "top"),
              item(`wool trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
          ]
        : [
            [
              item(`tailored linen blazer ${a}`, "outerwear"),
              item(`linen oxford shirt ${a}`, "top"),
              item(`wool pleated trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
            [
              item(`navy wool blazer ${a}`, "outerwear"),
              item(`cream linen shirt ${a}`, "top"),
              item(`pleated trousers ${a}`, "bottom"),
              item(`suede loafers ${a}`, "shoes"),
            ],
            [
              item(`beige linen blazer ${a}`, "outerwear"),
              item(`striped oxford shirt ${a}`, "top"),
              item(`wool trousers ${a}`, "bottom"),
              item(`penny loafers ${a}`, "shoes"),
            ],
            [
              item(`tailored blazer ${a}`, "outerwear"),
              item(`white oxford shirt ${a}`, "top"),
              item(`grey pleated trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
            [
              item(`unstructured linen blazer ${a}`, "outerwear"),
              item(`chambray oxford shirt ${a}`, "top"),
              item(`tailored wool trousers ${a}`, "bottom"),
              item(`bit loafers ${a}`, "shoes"),
            ],
            [
              item(`navy sport coat ${a}`, "outerwear"),
              item(`linen shirt ${a}`, "top"),
              item(`cream pleated trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
          ],
      index
    );
  }

  if (aesthetic === "dressy") {
    return rotate(
      women
        ? [
            [
              item(`tailored blazer ${a}`, "outerwear"),
              item(`dress blouse ${a}`, "top"),
              item(`tailored trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
            [
              item(`satin blazer ${a}`, "outerwear"),
              item(`silk shirt ${a}`, "top"),
              item(`wide tailored trousers ${a}`, "bottom"),
              item(`dress shoes ${a}`, "shoes"),
            ],
            [
              item(`black tailored blazer ${a}`, "outerwear"),
              item(`dress shirt ${a}`, "top"),
              item(`cigarette trousers ${a}`, "bottom"),
              item(`loafers ${a}`, "shoes"),
            ],
            [
              item(`navy tailored blazer ${a}`, "outerwear"),
              item(`cream blouse ${a}`, "top"),
              item(`tailored trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
            [
              item(`velvet blazer ${a}`, "outerwear"),
              item(`dress blouse ${a}`, "top"),
              item(`black tailored trousers ${a}`, "bottom"),
              item(`dress shoes ${a}`, "shoes"),
            ],
            [
              item(`structured blazer ${a}`, "outerwear"),
              item(`satin shirt ${a}`, "top"),
              item(`tailored trousers ${a}`, "bottom"),
              item(`loafers ${a}`, "shoes"),
            ],
          ]
        : [
            [
              item(`tailored blazer ${a}`, "outerwear"),
              item(`white dress shirt ${a}`, "top"),
              item(`tailored trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
            [
              item(`navy tailored blazer ${a}`, "outerwear"),
              item(`black dress shirt ${a}`, "top"),
              item(`charcoal tailored trousers ${a}`, "bottom"),
              item(`dress shoes ${a}`, "shoes"),
            ],
            [
              item(`black tailored blazer ${a}`, "outerwear"),
              item(`dress shirt ${a}`, "top"),
              item(`black tailored trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
            [
              item(`dinner jacket ${a}`, "outerwear"),
              item(`white dress shirt ${a}`, "top"),
              item(`tailored trousers ${a}`, "bottom"),
              item(`dress shoes ${a}`, "shoes"),
            ],
            [
              item(`velvet blazer ${a}`, "outerwear"),
              item(`silk dress shirt ${a}`, "top"),
              item(`dark tailored trousers ${a}`, "bottom"),
              item(`loafers ${a}`, "shoes"),
            ],
            [
              item(`structured blazer ${a}`, "outerwear"),
              item(`oxford dress shirt ${a}`, "top"),
              item(`grey tailored trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
          ],
      index
    );
  }

  if (aesthetic === "formal") {
    return rotate(
      women
        ? [
            [
              item(`tailored blazer ${a}`, "outerwear"),
              item(`formal blouse ${a}`, "top"),
              item(`formal trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
            [
              item(`suit jacket ${a}`, "outerwear"),
              item(`dress shirt ${a}`, "top"),
              item(`formal trousers ${a}`, "bottom"),
              item(`loafers ${a}`, "shoes"),
            ],
            [
              item(`navy suit jacket ${a}`, "outerwear"),
              item(`white dress blouse ${a}`, "top"),
              item(`navy formal trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
            [
              item(`black tailored blazer ${a}`, "outerwear"),
              item(`formal shirt ${a}`, "top"),
              item(`black formal trousers ${a}`, "bottom"),
              item(`loafers ${a}`, "shoes"),
            ],
            [
              item(`charcoal suit jacket ${a}`, "outerwear"),
              item(`dress blouse ${a}`, "top"),
              item(`charcoal formal trousers ${a}`, "bottom"),
              item(`leather loafers ${a}`, "shoes"),
            ],
            [
              item(`tailored blazer ${a}`, "outerwear"),
              item(`white formal blouse ${a}`, "top"),
              item(`tailored formal trousers ${a}`, "bottom"),
              item(`loafers ${a}`, "shoes"),
            ],
          ]
        : [
            [
              item(`suit jacket ${a}`, "outerwear"),
              item(`white formal shirt ${a}`, "top"),
              item(`formal trousers ${a}`, "bottom"),
              item(`leather oxfords ${a}`, "shoes"),
            ],
            [
              item(`navy tailored blazer ${a}`, "outerwear"),
              item(`dress shirt ${a}`, "top"),
              item(`navy formal trousers ${a}`, "bottom"),
              item(`oxford shoes ${a}`, "shoes"),
            ],
            [
              item(`black suit jacket ${a}`, "outerwear"),
              item(`white dress shirt ${a}`, "top"),
              item(`black formal trousers ${a}`, "bottom"),
              item(`leather oxfords ${a}`, "shoes"),
            ],
            [
              item(`charcoal tailored blazer ${a}`, "outerwear"),
              item(`formal shirt ${a}`, "top"),
              item(`charcoal formal trousers ${a}`, "bottom"),
              item(`oxfords ${a}`, "shoes"),
            ],
            [
              item(`midnight suit jacket ${a}`, "outerwear"),
              item(`white formal dress shirt ${a}`, "top"),
              item(`formal trousers ${a}`, "bottom"),
              item(`cap toe oxfords ${a}`, "shoes"),
            ],
            [
              item(`tailored blazer ${a}`, "outerwear"),
              item(`dress shirt ${a}`, "top"),
              item(`grey formal trousers ${a}`, "bottom"),
              item(`leather oxfords ${a}`, "shoes"),
            ],
          ],
      index
    );
  }

  if (aesthetic === "street") {
    return rotate(
      [
        [
          item(`bomber jacket ${a}`, "outerwear"),
          item(`graphic tee ${a}`, "top"),
          item(`relaxed jeans ${a}`, "bottom"),
          item(`white sneakers ${a}`, "shoes"),
        ],
        [
          item(`oversized bomber ${a}`, "outerwear"),
          item(`hoodie ${a}`, "top"),
          item(`cargo pants ${a}`, "bottom"),
          item(`chunky sneakers ${a}`, "shoes"),
        ],
        [
          item(`nylon bomber jacket ${a}`, "outerwear"),
          item(`black tee ${a}`, "top"),
          item(`baggy jeans ${a}`, "bottom"),
          item(`sneakers ${a}`, "shoes"),
        ],
        [
          item(`varsity bomber ${a}`, "outerwear"),
          item(`hoodie ${a}`, "top"),
          item(`cargo trousers ${a}`, "bottom"),
          item(`black sneakers ${a}`, "shoes"),
        ],
        [
          item(`light bomber jacket ${a}`, "outerwear"),
          item(`striped tee ${a}`, "top"),
          item(`straight jeans ${a}`, "bottom"),
          item(`canvas sneakers ${a}`, "shoes"),
        ],
        [
          item(`cropped bomber ${a}`, "outerwear"),
          item(`cotton hoodie ${a}`, "top"),
          item(`cargo jeans ${a}`, "bottom"),
          item(`sneakers ${a}`, "shoes"),
        ],
      ],
      index
    );
  }

  if (aesthetic === "ethnic") {
    return rotate(
      [
        [
          item(`nehru jacket ${a}`, "outerwear"),
          item(`kurta ${a}`, "top"),
          item(`churidar trousers ${a}`, "bottom"),
          item(`leather loafers ${a}`, "shoes"),
        ],
        [
          item(`embroidered jacket ${a}`, "outerwear"),
          item(`linen shirt ${a}`, "top"),
          item(`straight trousers ${a}`, "bottom"),
          item(`loafers ${a}`, "shoes"),
        ],
        [
          item(`nehru jacket ${a}`, "outerwear"),
          item(`silk kurta ${a}`, "top"),
          item(`formal trousers ${a}`, "bottom"),
          item(`mojari loafers ${a}`, "shoes"),
        ],
        [
          item(`bandhgala jacket ${a}`, "outerwear"),
          item(`cotton kurta ${a}`, "top"),
          item(`trousers ${a}`, "bottom"),
          item(`leather loafers ${a}`, "shoes"),
        ],
        [
          item(`linen jacket ${a}`, "outerwear"),
          item(`short kurta ${a}`, "top"),
          item(`tapered trousers ${a}`, "bottom"),
          item(`loafers ${a}`, "shoes"),
        ],
        [
          item(`nehru jacket ${a}`, "outerwear"),
          item(`printed shirt ${a}`, "top"),
          item(`linen trousers ${a}`, "bottom"),
          item(`leather loafers ${a}`, "shoes"),
        ],
      ],
      index
    );
  }

  // casual + smart: tees, polos, chinos, optional overshirt
  if (women) {
    return rotate(
      [
        [
          item(`white shirt ${a}`, "top"),
          item(`high waist trousers ${a}`, "bottom"),
          item(`white sneakers ${a}`, "shoes"),
        ],
        [
          item(`olive overshirt ${a}`, "outerwear"),
          item(`knit top ${a}`, "top"),
          item(`straight fit jeans ${a}`, "bottom"),
          item(`ballet flats ${a}`, "shoes"),
        ],
        [
          item(`formal blouse ${a}`, "top"),
          item(`tailored trousers ${a}`, "bottom"),
          item(`block heels ${a}`, "shoes"),
        ],
        [
          item(`cotton top ${a}`, "top"),
          item(`wide leg pants ${a}`, "bottom"),
          item(`casual sandals ${a}`, "shoes"),
        ],
        [
          item(`linen shirt ${a}`, "top"),
          item(`linen pants ${a}`, "bottom"),
          item(`flat mules ${a}`, "shoes"),
        ],
        [
          item(`black top ${a}`, "top"),
          item(`grey jeans ${a}`, "bottom"),
          item(`black sneakers ${a}`, "shoes"),
        ],
      ],
      index
    );
  }

  return rotate(
    [
      [
        item(`navy polo shirt ${a}`, "top"),
        item(`beige chinos ${a}`, "bottom"),
        item(`white sneakers ${a}`, "shoes"),
      ],
      [
        item(`olive overshirt ${a}`, "outerwear"),
        item(`white crew neck tshirt ${a}`, "top"),
        item(`charcoal trousers ${a}`, "bottom"),
        item(`brown loafers ${a}`, "shoes"),
      ],
      [
        item(`maroon formal shirt ${a}`, "top"),
        item(`khaki chinos ${a}`, "bottom"),
        item(`brown formal shoes ${a}`, "shoes"),
      ],
      [
        item(`grey sweater ${a}`, "top"),
        item(`navy chinos ${a}`, "bottom"),
        item(`white casual shoes ${a}`, "shoes"),
      ],
      [
        item(`linen shirt ${a}`, "top"),
        item(`tailored trousers ${a}`, "bottom"),
        item(`leather loafers ${a}`, "shoes"),
      ],
      [
        item(`black tshirt ${a}`, "top"),
        item(`grey jeans ${a}`, "bottom"),
        item(`black sneakers ${a}`, "shoes"),
      ],
    ],
    index
  );
}
