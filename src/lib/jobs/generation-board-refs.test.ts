import { describe, expect, it, vi } from "vitest";
import type { LookProduct, PlannedLook } from "@/types/generation";
import { prefetchProductImageUrls } from "@/lib/azure/images";
import {
  boardFailureReason,
  decideOnlineEmptyRefsOutcome,
  buildFashionBoardPrompt,
  buildProductImageRefs,
  buildSimpleFallbackLook,
  compactProductImageRefs,
  composeShoppableLooks,
  filterProductsToBoardRefs,
  finalizeBoardImageRefs,
  isDressCentricLook,
  isRealProduct,
  lookMeetsVerifiedProductGate,
  MAX_PRODUCT_IMAGE_REFS,
  requiredPrimaryCategories,
  selectLooksForBoard,
  shoppingSlotsForLook,
  shouldSkipShoppingLayer,
} from "./generation";

function product(partial: Partial<LookProduct> & { title: string }): LookProduct {
  return {
    productUrl: `https://www.myntra.com/p/${encodeURIComponent(partial.title)}`,
    source: "myntra",
    imageUrl: `https://assets.myntra.com/${encodeURIComponent(partial.title)}.jpg`,
    verified: true,
    availability: "in_stock",
    matchCategory: "top",
    ...partial,
  };
}

function look(label: string): PlannedLook {
  return {
    label,
    productSearchQuery: label,
    items: [
      { category: "top", description: "planned navy shirt" },
      { category: "bottom", description: "planned cream trousers" },
      { category: "shoes", description: "planned black loafers" },
    ],
  };
}

describe("buildProductImageRefs", () => {
  it("round-robins so later looks still get a real garment under the image cap", () => {
    const looksProducts = Array.from({ length: 6 }, (_, lookIndex) => ({
      products: [
        product({
          title: `Look ${lookIndex} shirt`,
          matchCategory: "top",
        }),
        product({
          title: `Look ${lookIndex} pants`,
          matchCategory: "bottom",
        }),
        product({
          title: `Look ${lookIndex} shoes`,
          matchCategory: "shoes",
        }),
      ],
    }));

    const { productImageUrls, productImageRefs } =
      buildProductImageRefs(looksProducts);

    expect(productImageUrls.length).toBe(MAX_PRODUCT_IMAGE_REFS);
    const looksWithRefs = new Set(productImageRefs.map((r) => r.lookIndex));
    expect([...looksWithRefs].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(productImageRefs.some((r) => r.lookIndex === 5)).toBe(true);

    // Depth-major fill: with 18 candidates and a cap of 12, every look gets
    // its 2nd ref before any look gets a 3rd — exactly 2 unique images each.
    for (let i = 0; i < 6; i++) {
      const urls = new Set(
        productImageRefs.filter((r) => r.lookIndex === i).map((r) => r.imageUrl)
      );
      expect(urls.size).toBe(2);
    }
  });

  it("takes all 12 refs when 6 looks have 2 thumbs each (cap 12)", () => {
    const looksProducts = Array.from({ length: 6 }, (_, lookIndex) => ({
      products: [
        product({
          title: `Look ${lookIndex} shirt`,
          matchCategory: "top",
        }),
        product({
          title: `Look ${lookIndex} pants`,
          matchCategory: "bottom",
        }),
      ],
    }));

    const { productImageUrls, productImageRefs } =
      buildProductImageRefs(looksProducts);

    expect(MAX_PRODUCT_IMAGE_REFS).toBe(12);
    expect(productImageUrls.length).toBe(12);
    for (let i = 0; i < 6; i++) {
      const urls = new Set(
        productImageRefs.filter((r) => r.lookIndex === i).map((r) => r.imageUrl)
      );
      expect(urls.size).toBe(2);
    }
  });
});

describe("compactProductImageRefs", () => {
  it("re-numbers Image 2..N to the files that actually uploaded", () => {
    const refs = [
      {
        lookIndex: 0,
        imageIndex: 2,
        category: "top",
        title: "shirt",
        imageUrl: "https://cdn.myntra.com/shirt.jpg",
      },
      {
        lookIndex: 0,
        imageIndex: 3,
        category: "shoes",
        title: "loafers",
        imageUrl: "https://cdn.myntra.com/loafers.jpg",
      },
      {
        lookIndex: 1,
        imageIndex: 4,
        category: "bottom",
        title: "pants",
        imageUrl: "https://cdn.myntra.com/pants.jpg",
      },
    ];
    const compacted = compactProductImageRefs(refs, [
      "https://cdn.myntra.com/shirt.jpg",
      "https://cdn.myntra.com/pants.jpg",
    ]);
    expect(compacted).toHaveLength(2);
    expect(compacted[0]).toMatchObject({
      title: "shirt",
      imageIndex: 2,
    });
    expect(compacted[1]).toMatchObject({
      title: "pants",
      imageIndex: 3,
      lookIndex: 1,
    });
  });
});

describe("filterProductsToBoardRefs", () => {
  it("drops shop links whose photo was not uploaded", () => {
    const shirt = product({ title: "Oxford shirt", matchCategory: "top" });
    const shoes = product({ title: "White sneakers", matchCategory: "shoes" });
    const filtered = filterProductsToBoardRefs(
      [{ products: [shirt, shoes] }],
      [
        {
          lookIndex: 0,
          imageIndex: 2,
          category: "top",
          title: shirt.title!,
          imageUrl: shirt.imageUrl!,
        },
      ]
    );
    expect(filtered[0]!.products).toEqual([shirt]);
  });
});

describe("finalizeBoardImageRefs", () => {
  it("rewrites look items from painted products and tail-appends the rest as shop rows", () => {
    const look0shirt = product({
      title: "Navy linen shirt",
      matchCategory: "top",
    });
    const look0shoes = product({
      title: "White sneakers",
      matchCategory: "shoes",
    });
    const look1pants = product({
      title: "Cream trousers",
      matchCategory: "bottom",
    });
    const look2dress = product({
      title: "Failed fetch dress",
      matchCategory: "dress",
    });

    const result = finalizeBoardImageRefs({
      looks: [look("Office"), look("Weekend"), look("Dinner")],
      looksProducts: [
        { products: [look0shirt, look0shoes] },
        { products: [look1pants] },
        { products: [look2dress] },
      ],
      refs: [
        {
          lookIndex: 0,
          imageIndex: 2,
          category: "top",
          title: look0shirt.title!,
          imageUrl: look0shirt.imageUrl!,
        },
        {
          lookIndex: 0,
          imageIndex: 3,
          category: "shoes",
          title: look0shoes.title!,
          imageUrl: look0shoes.imageUrl!,
        },
        {
          lookIndex: 1,
          imageIndex: 4,
          category: "bottom",
          title: look1pants.title!,
          imageUrl: look1pants.imageUrl!,
        },
        {
          lookIndex: 2,
          imageIndex: 5,
          category: "dress",
          title: look2dress.title!,
          imageUrl: look2dress.imageUrl!,
        },
      ],
      uploadedUrls: [look0shirt.imageUrl!, look1pants.imageUrl!],
    });

    expect(result.looks).toHaveLength(2);
    expect(result.looks[0]!.label).toBe("Office");
    // Items (the prompt brief) stay painted-only …
    expect(result.looks[0]!.items).toEqual([
      {
        category: "top",
        description: "Navy linen shirt",
        searchQuery: "Navy linen shirt",
        wardrobeItemId: undefined,
      },
    ]);
    expect(result.looks[0]!.items?.some((it) => /loafer/i.test(it.description))).toBe(
      false
    );
    expect(result.looks[0]!.description).toBe(
      "top: Navy linen shirt; shoes: White sneakers"
    );
    expect(result.looks[0]!.productSearchQuery).toBe(
      "top: Navy linen shirt; shoes: White sneakers"
    );
    // … but shop rows keep every resolved product, painted first.
    expect(result.looksProducts[0]!.products).toEqual([look0shirt, look0shoes]);
    expect(result.looks[1]!.label).toBe("Weekend");
    expect(result.looks[1]!.description).toBe("bottom: Cream trousers");
    expect(result.looksProducts[1]!.products).toEqual([look1pants]);
    // A look whose thumbs all failed to upload (zero refs) is dropped.
    expect(result.looks.some((l) => l.label === "Dinner")).toBe(false);
    expect(result.looksProducts).toHaveLength(2);
    expect(result.refs.map((r) => r.lookIndex).sort()).toEqual([0, 1]);
    expect(result.refs.find((r) => r.lookIndex === 1)?.imageIndex).toBe(3);
    expect(result.productImageUrls).toEqual([
      look0shirt.imageUrl,
      look1pants.imageUrl,
    ]);
  });

  it("keeps 3 shop rows painted-first when only 2 of 3 products made the ref cap", () => {
    const shirt = product({ title: "Oxford shirt", matchCategory: "top" });
    const pants = product({ title: "Grey trousers", matchCategory: "bottom" });
    const shoes = product({ title: "Black loafers", matchCategory: "shoes" });

    const result = finalizeBoardImageRefs({
      looks: [look("Office")],
      looksProducts: [{ products: [shirt, pants, shoes] }],
      refs: [
        {
          lookIndex: 0,
          imageIndex: 2,
          category: "top",
          title: shirt.title!,
          imageUrl: shirt.imageUrl!,
        },
        {
          lookIndex: 0,
          imageIndex: 3,
          category: "bottom",
          title: pants.title!,
          imageUrl: pants.imageUrl!,
        },
      ],
      uploadedUrls: [shirt.imageUrl!, pants.imageUrl!, shoes.imageUrl!],
    });

    expect(result.looks).toHaveLength(1);
    expect(result.looksProducts[0]!.products).toEqual([shirt, pants, shoes]);
    expect(
      result.refs.filter((r) => r.lookIndex === 0).map((r) => r.title)
    ).toEqual(["Oxford shirt", "Grey trousers"]);
  });

  it("restores a look's primary dress when its photo uploaded but the ref was dropped", () => {
    const dress = product({
      title: "Floral Maxi",
      matchCategory: "garment",
      imageUrl: "https://assets.myntra.com/floral-maxi.jpg",
    });
    const belt = product({
      title: "Leather belt",
      matchCategory: "accessory",
      imageUrl: "https://assets.myntra.com/belt.jpg",
    });
    const dressLook: PlannedLook = {
      label: "Garden",
      productSearchQuery: "Floral Maxi",
      items: [{ category: "dress", description: "floral maxi" }],
    };

    const result = finalizeBoardImageRefs({
      looks: [dressLook],
      looksProducts: [{ products: [dress, belt] }],
      refs: [
        {
          lookIndex: 0,
          imageIndex: 2,
          category: "accessory",
          title: belt.title!,
          imageUrl: belt.imageUrl!,
        },
      ],
      uploadedUrls: [dress.imageUrl!, belt.imageUrl!],
    });

    expect(result.looks).toHaveLength(1);
    expect(result.looksProducts[0]!.products.some((p) => p.title === "Floral Maxi")).toBe(
      true
    );
    expect(result.refs.some((r) => r.title === "Floral Maxi")).toBe(true);
  });

  it("keeps shoppable looks with empty refs when every thumbnail failed to prefetch", () => {
    const look0shirt = product({
      title: "Navy linen shirt",
      matchCategory: "top",
    });
    const look0shoes = product({
      title: "White sneakers",
      matchCategory: "shoes",
    });
    const look1pants = product({
      title: "Cream trousers",
      matchCategory: "bottom",
    });
    const look2dress = product({
      title: "Failed fetch dress",
      matchCategory: "dress",
    });
    const wardrobeOnly: LookProduct = {
      title: "Owned tee",
      kind: "wardrobe",
      matchCategory: "top",
      imageUrl: "https://cdn.example.com/tee.jpg",
    };

    const result = finalizeBoardImageRefs({
      looks: [look("Office"), look("Weekend"), look("Dinner"), look("Closet")],
      looksProducts: [
        { products: [look0shirt, look0shoes] },
        { products: [look1pants] },
        { products: [look2dress] },
        { products: [wardrobeOnly] },
      ],
      refs: [
        {
          lookIndex: 0,
          imageIndex: 2,
          category: "top",
          title: look0shirt.title!,
          imageUrl: look0shirt.imageUrl!,
        },
        {
          lookIndex: 1,
          imageIndex: 3,
          category: "bottom",
          title: look1pants.title!,
          imageUrl: look1pants.imageUrl!,
        },
        {
          lookIndex: 2,
          imageIndex: 4,
          category: "dress",
          title: look2dress.title!,
          imageUrl: look2dress.imageUrl!,
        },
      ],
      uploadedUrls: [],
    });

    expect(result.looks.map((l) => l.label)).toEqual([
      "Office",
      "Weekend",
      "Dinner",
    ]);
    expect(result.looksProducts[0]!.products).toEqual([look0shirt, look0shoes]);
    expect(result.looksProducts[1]!.products).toEqual([look1pants]);
    expect(result.looksProducts[2]!.products).toEqual([look2dress]);
    expect(result.refs).toEqual([]);
    expect(result.refs.every((r) => r.imageIndex >= 2)).toBe(true);
    expect(result.productImageUrls).toEqual([]);
    expect(result.looks[0]!.description).toBe(
      "top: Navy linen shirt; shoes: White sneakers"
    );
    expect(result.looks[0]!.productSearchQuery).toBe(
      "top: Navy linen shirt; shoes: White sneakers"
    );
    expect(result.looks[0]!.items).toEqual([
      {
        category: "top",
        description: "Navy linen shirt",
        searchQuery: "Navy linen shirt",
        wardrobeItemId: undefined,
      },
      {
        category: "shoes",
        description: "White sneakers",
        searchQuery: "White sneakers",
        wardrobeItemId: undefined,
      },
    ]);
  });
});

describe("isRealProduct", () => {
  const liveBuy =
    "https://www.snitch.com/men-shirts/regular-fit-black-shirt-4sfs145-02/9269896904866/buy";

  it("is false for dead Snitch /products URLs even when verified", () => {
    expect(
      isRealProduct({
        productUrl: "https://www.snitch.com/products/floral-midi",
        imageUrl: "https://cdn.snitch.com/floral.jpg",
        source: "snitch",
        verified: true,
        availability: "in_stock",
      })
    ).toBe(false);
    expect(
      isRealProduct({
        productUrl: "https://www.snitch.co.in/products/floral-midi",
        imageUrl: "https://cdn.snitch.com/floral.jpg",
        verified: true,
      })
    ).toBe(false);
  });

  it("is true for a live Snitch /buy PDP", () => {
    expect(
      isRealProduct({
        productUrl: liveBuy,
        imageUrl: "https://cdn.snitch.com/shirt.jpg",
        source: "snitch",
        verified: true,
        availability: "in_stock",
      })
    ).toBe(true);
  });
});

describe("buildFashionBoardPrompt", () => {
  it("bans inventing extra shoppable pieces when a panel has refs", () => {
    const prompt = buildFashionBoardPrompt({
      personBlock: "Subject is 30",
      path: "online",
      looks: [look("Garden")],
      productImageRefs: [
        {
          lookIndex: 0,
          imageIndex: 2,
          category: "dress",
          title: "Floral Maxi",
          imageUrl: "https://cdn.myntra.com/maxi.jpg",
        },
      ],
      requireProductRefsPerPanel: true,
    });
    expect(prompt).toMatch(/do not invent extra shoppable pieces/i);
    expect(prompt).not.toMatch(/unbranded basics/i);
    expect(prompt).toMatch(
      /distinct shoppable-looking items MUST equal 1/i
    );
    expect(prompt).toMatch(/the number of Use-Image instructions/i);
    expect(prompt).not.toMatch(/style a complete, cohesive outfit from the brief/i);
  });

  it("zero-ref panels do not ask for a full shoppable outfit", () => {
    const prompt = buildFashionBoardPrompt({
      personBlock: "Subject is 30",
      path: "online",
      looks: [look("Garden")],
      productImageRefs: [],
      requireProductRefsPerPanel: true,
    });
    expect(prompt).not.toMatch(/style a complete, cohesive outfit from the brief/i);
    expect(prompt).toMatch(/do not invent a full shoppable outfit/i);
    expect(prompt).toMatch(/unbranded basics/i);
    expect(prompt).toMatch(
      /do not paint a distinct dress, jacket, or shoes/i
    );
    expect(prompt).not.toMatch(/Outfit pieces:/i);
    expect(prompt).not.toMatch(/planned navy shirt/i);
  });

  it("does not interpolate look description when product refs are present", () => {
    const planned: PlannedLook = {
      label: "Garden",
      description: "floral midi dress and woven bag",
      productSearchQuery: "floral midi dress and woven bag",
      items: [{ category: "outerwear", description: "denim jacket" }],
    };
    const prompt = buildFashionBoardPrompt({
      personBlock: "Subject is 30",
      path: "online",
      looks: [planned],
      productImageRefs: [
        {
          lookIndex: 0,
          imageIndex: 2,
          category: "outerwear",
          title: "Denim Jacket",
          imageUrl: "https://cdn.myntra.com/jacket.jpg",
        },
      ],
      requireProductRefsPerPanel: true,
    });
    expect(prompt).not.toContain("floral midi dress and woven bag");
    expect(prompt).toMatch(/Use outerwear from \[Image 2\]/);
    expect(prompt).toMatch(/PANEL 1 — "Garden"/);
  });

  it("puts the named aesthetic on the Style line instead of defaulting to smart casual", () => {
    const prompt = buildFashionBoardPrompt({
      personBlock: "Subject is 30",
      path: "online",
      styleType: "old money",
      looks: [look("Estate")],
    });
    expect(prompt).toContain("old money");
    expect(prompt).not.toContain("Style: smart casual");
  });

  it("defaults Style to smart casual when style fields are unset", () => {
    const prompt = buildFashionBoardPrompt({
      personBlock: "Subject is 30",
      path: "online",
      looks: [look("Office")],
    });
    expect(prompt).toMatch(/Style: smart casual/);
  });
});

describe("shouldSkipShoppingLayer", () => {
  const topBottomLook = look("Office");
  const dressLook: PlannedLook = {
    label: "Garden",
    productSearchQuery: "Floral Maxi",
    items: [{ category: "dress", description: "floral maxi" }],
  };

  it("shops required primaries without SerpAPI and skips accessories/shoes", () => {
    expect(
      shouldSkipShoppingLayer({
        hasSerpapi: false,
        category: "top",
        look: topBottomLook,
      })
    ).toBe(false);
    expect(
      shouldSkipShoppingLayer({
        hasSerpapi: false,
        category: "bottom",
        look: topBottomLook,
      })
    ).toBe(false);
    expect(
      shouldSkipShoppingLayer({
        hasSerpapi: false,
        category: "accessory",
        look: topBottomLook,
      })
    ).toBe(true);
    expect(
      shouldSkipShoppingLayer({
        hasSerpapi: false,
        category: "shoes",
        look: topBottomLook,
      })
    ).toBe(true);
    expect(
      shouldSkipShoppingLayer({
        hasSerpapi: false,
        category: "dress",
        look: dressLook,
      })
    ).toBe(false);
  });

  it("never skips when SerpAPI is configured", () => {
    expect(
      shouldSkipShoppingLayer({
        hasSerpapi: true,
        category: "accessory",
        look: topBottomLook,
      })
    ).toBe(false);
  });

  it("does not treat Mini Skirt as a dress-centric look", () => {
    const miniSkirtLook: PlannedLook = {
      label: "Weekend",
      productSearchQuery: "Mini Skirt",
      items: [{ category: "bottom", description: "Mini Skirt" }],
    };
    expect(requiredPrimaryCategories(miniSkirtLook)).not.toContain("dress");
    expect(
      shouldSkipShoppingLayer({
        hasSerpapi: false,
        category: "bottom",
        look: miniSkirtLook,
      })
    ).toBe(false);
  });

  it("shops outerwear for office-party looks with a blazer, still skipping shoes/accessories", () => {
    const officePartyLook: PlannedLook = {
      label: "After Hours",
      description: "tailored blazer over a dress shirt",
      productSearchQuery: "office party blazer",
      items: [
        { category: "outerwear", description: "navy tailored blazer" },
        { category: "top", description: "white dress shirt" },
        { category: "bottom", description: "tailored trousers" },
      ],
    };
    expect(
      shouldSkipShoppingLayer({
        hasSerpapi: false,
        category: "outerwear",
        look: officePartyLook,
        brief: "office party",
      })
    ).toBe(false);
    expect(
      shouldSkipShoppingLayer({
        hasSerpapi: false,
        category: "accessory",
        look: officePartyLook,
        brief: "office party",
      })
    ).toBe(true);
    expect(
      shouldSkipShoppingLayer({
        hasSerpapi: false,
        category: "shoes",
        look: officePartyLook,
        brief: "office party",
      })
    ).toBe(true);
  });
});

describe("buildProductImageRefs dress coverage", () => {
  it("keeps a dress image for all 6 looks under the cap", () => {
    const looksProducts = Array.from({ length: 6 }, (_, lookIndex) => ({
      products: [
        product({
          title: `Look ${lookIndex} Floral Midi`,
          matchCategory: "garment",
          imageUrl: `https://assets.myntra.com/look${lookIndex}-dress.jpg`,
        }),
        product({
          title: `Look ${lookIndex} belt`,
          matchCategory: "accessory",
          imageUrl: `https://assets.myntra.com/look${lookIndex}-belt.jpg`,
        }),
      ],
    }));

    const { productImageUrls, productImageRefs } =
      buildProductImageRefs(looksProducts);

    expect(productImageUrls.length).toBe(MAX_PRODUCT_IMAGE_REFS);
    expect(MAX_PRODUCT_IMAGE_REFS).toBe(12);
    for (let i = 0; i < 6; i++) {
      const refs = productImageRefs.filter((r) => r.lookIndex === i);
      expect(refs.some((r) => r.category === "dress" || /midi/i.test(r.title))).toBe(
        true
      );
    }
  });
});

describe("isDressCentricLook", () => {
  it("treats floral midi dress with a denim jacket as dress-centric", () => {
    const planned: PlannedLook = {
      label: "Garden",
      description: "floral midi dress with a denim jacket",
      productSearchQuery: "floral midi dress denim jacket",
      items: [
        { category: "top", description: "floral midi dress" },
        { category: "outerwear", description: "denim jacket" },
      ],
    };
    expect(isDressCentricLook(planned)).toBe(true);
    expect(requiredPrimaryCategories(planned)).toEqual(["dress"]);
  });

  it("does not treat Mini Skirt as dress-centric", () => {
    const planned: PlannedLook = {
      label: "Weekend",
      productSearchQuery: "Mini Skirt",
      items: [{ category: "bottom", description: "Mini Skirt" }],
    };
    expect(isDressCentricLook(planned)).toBe(false);
    expect(requiredPrimaryCategories(planned)).not.toContain("dress");
  });

  it("does not treat Dress shirt as dress-centric", () => {
    const planned: PlannedLook = {
      label: "Office",
      productSearchQuery: "Dress shirt",
      items: [{ category: "top", description: "white dress shirt" }],
    };
    expect(isDressCentricLook(planned)).toBe(false);
    expect(requiredPrimaryCategories(planned)).not.toContain("dress");
  });

  it("includes outerwear for old-money looks with a blazer, not for casual top+bottom", () => {
    const withBlazer: PlannedLook = {
      label: "Estate",
      productSearchQuery: "linen blazer oxford",
      items: [
        { category: "outerwear", description: "navy blazer" },
        { category: "top", description: "linen oxford" },
        { category: "bottom", description: "wool trousers" },
      ],
    };
    expect(requiredPrimaryCategories(withBlazer, "old money")).toEqual(
      expect.arrayContaining(["outerwear", "top", "bottom"])
    );
    expect(requiredPrimaryCategories(look("Weekend"), "weekend casual")).not.toContain(
      "outerwear"
    );
  });
});

describe("shoppingSlotsForLook", () => {
  it("unshifts a dress slot as primary when a dress-centric look omitted dress", () => {
    const planned: PlannedLook = {
      label: "Garden",
      productSearchQuery: "floral midi dress",
      description: "a floral midi with a denim jacket",
      items: [
        {
          category: "outerwear",
          description: "denim jacket",
          searchQuery: "denim jacket",
        },
      ],
    };
    expect(isDressCentricLook(planned)).toBe(true);
    const slots = shoppingSlotsForLook(planned);
    expect(slots[0]).toEqual({
      category: "dress",
      searchQuery: "floral midi dress",
    });
    expect(slots.some((s) => s.category === "dress")).toBe(true);
  });

  it("injects missing outerwear for a dressy look and still returns at most 3 slots", () => {
    const planned: PlannedLook = {
      label: "After Hours",
      productSearchQuery: "office party",
      description: "dress shirt and tailored trousers",
      items: [
        {
          category: "top",
          description: "white dress shirt",
          searchQuery: "white dress shirt men",
        },
        {
          category: "bottom",
          description: "tailored trousers",
          searchQuery: "tailored trousers men",
        },
        {
          category: "shoes",
          description: "leather loafers",
          searchQuery: "leather loafers men",
        },
      ],
    };
    const slots = shoppingSlotsForLook(planned, "office party");
    expect(slots.some((s) => s.category === "outerwear")).toBe(true);
    expect(slots.length).toBeLessThanOrEqual(3);
    expect(slots).toHaveLength(3);
  });

  it("still returns 3 slots when a dressy plan only listed top and bottom", () => {
    const planned: PlannedLook = {
      label: "Estate",
      productSearchQuery: "old money",
      items: [
        { category: "top", description: "linen oxford", searchQuery: "linen oxford men" },
        { category: "bottom", description: "wool trousers", searchQuery: "wool trousers men" },
      ],
    };
    const slots = shoppingSlotsForLook(planned, "old money");
    expect(slots.map((s) => s.category)).toEqual(["outerwear", "top", "bottom"]);
  });
});

describe("lookMeetsVerifiedProductGate", () => {
  it("is false when a dress look has only a top product", () => {
    const planned: PlannedLook = {
      label: "Garden",
      productSearchQuery: "floral midi dress",
      items: [{ category: "dress", description: "floral midi" }],
    };
    const onlyTop = [product({ title: "Oxford shirt", matchCategory: "top" })];
    expect(lookMeetsVerifiedProductGate(planned, onlyTop)).toBe(false);
  });

  it("is false for a dressy look with top+bottom and no outerwear product", () => {
    const products = [
      product({ title: "Linen oxford", matchCategory: "top" }),
      product({ title: "Wool trousers", matchCategory: "bottom" }),
    ];
    expect(
      lookMeetsVerifiedProductGate(look("Estate"), products, "old money")
    ).toBe(false);
  });
});

const SHOP_FAIL =
  "We could not find verified products with shop links. Try again in a moment or widen your budget.";
const PHOTOS_FAIL =
  "We found products but could not load their photos for the board. Try again in a moment.";

function boardFailCopy(
  reason: ReturnType<typeof boardFailureReason>
): string | null {
  if (reason === "shop") return SHOP_FAIL;
  if (reason === "photos") return PHOTOS_FAIL;
  return null;
}

describe("composeShoppableLooks", () => {
  const plan = Array.from({ length: 6 }, (_, i) => look(`Look ${i + 1}`));

  it("builds six looks when each slot pool can fill six", () => {
    const products = Array.from({ length: 6 }, (_, i) => [
      product({ title: `Tee ${i}`, matchCategory: "top" }),
      product({ title: `Trousers ${i}`, matchCategory: "bottom" }),
      product({ title: `Loafers ${i}`, matchCategory: "shoes" }),
    ]).flat();
    const composed = composeShoppableLooks({ lookCount: 6, plan, products });
    expect(composed.looks).toHaveLength(6);
    const chat = composeShoppableLooks({ lookCount: 3, plan, products });
    expect(chat.looks).toHaveLength(3);
    for (const row of composed.productsByLook) {
      expect(row.map((p) => p.matchCategory).sort()).toEqual([
        "bottom",
        "shoes",
        "top",
      ]);
    }
  });

  it("returns a shorter board when the shoe pool is short", () => {
    const products = [
      ...Array.from({ length: 6 }, (_, i) =>
        product({ title: `Tee ${i}`, matchCategory: "top" })
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        product({ title: `Trousers ${i}`, matchCategory: "bottom" })
      ),
      ...Array.from({ length: 2 }, (_, i) =>
        product({ title: `Loafers ${i}`, matchCategory: "shoes" })
      ),
    ];
    const composed = composeShoppableLooks({ lookCount: 6, plan, products });
    expect(composed.looks).toHaveLength(2);
    expect(
      composed.productsByLook.every((row) =>
        row.some((p) => p.matchCategory === "shoes")
      )
    ).toBe(true);
  });

  it("names only composed products in the look and in image refs", () => {
    const products = [
      ...Array.from({ length: 6 }, (_, i) =>
        product({ title: `Tee ${i}`, matchCategory: "top" })
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        product({ title: `Trousers ${i}`, matchCategory: "bottom" })
      ),
      product({ title: "Loafers 0", matchCategory: "shoes" }),
      product({ title: "Loafers 1", matchCategory: "shoes" }),
      product({
        title: "No photo",
        matchCategory: "top",
        imageUrl: undefined,
      }),
    ];
    const composed = composeShoppableLooks({ lookCount: 6, plan, products });
    const allowed = new Set(
      composed.productsByLook.flat().map((p) => p.imageUrl)
    );
    expect(allowed.has(undefined)).toBe(false);
    expect([...allowed].some((url) => url?.includes("No%20photo"))).toBe(false);
    const built = buildProductImageRefs(
      composed.productsByLook.map((row) => ({ products: row }))
    );
    expect(built.productImageRefs.length).toBeGreaterThan(0);
    for (const ref of built.productImageRefs) {
      expect(allowed.has(ref.imageUrl)).toBe(true);
    }
    for (const item of composed.looks.flatMap((l) => l.items ?? [])) {
      expect(
        composed.productsByLook
          .flat()
          .some((p) => p.title === item.description)
      ).toBe(true);
    }
  });
});

describe("selectLooksForBoard", () => {
  const topBottom = [
    product({ title: "Linen oxford", matchCategory: "top" }),
    product({ title: "Wool trousers", matchCategory: "bottom" }),
  ];
  const withBlazer = [
    product({ title: "Navy blazer", matchCategory: "outerwear" }),
    product({ title: "Linen oxford", matchCategory: "top" }),
    product({ title: "Wool trousers", matchCategory: "bottom" }),
  ];
  const dressLook: PlannedLook = {
    label: "Garden",
    productSearchQuery: "floral midi dress",
    items: [{ category: "dress", description: "floral midi" }],
  };

  it("keeps a dressy look with shoppable top+bottom when no look has a blazer", () => {
    const planned = look("Estate");
    expect(
      lookMeetsVerifiedProductGate(planned, topBottom, "old money")
    ).toBe(false);
    expect(
      selectLooksForBoard([planned], [{ products: topBottom }], "old money")
    ).toEqual([0]);
  });

  it("keeps full-gate looks first, then core-gate looks when some have outerwear", () => {
    expect(
      selectLooksForBoard(
        [look("Estate"), look("Club")],
        [{ products: withBlazer }, { products: topBottom }],
        "old money"
      )
    ).toEqual([0, 1]);
  });

  it("puts full-gate looks first when a core-only look is earlier in the plan", () => {
    expect(
      selectLooksForBoard(
        [look("Club"), look("Estate"), look("Club")],
        [
          { products: topBottom },
          { products: withBlazer },
          { products: withBlazer },
        ],
        "old money"
      )
    ).toEqual([1, 2, 0]);
  });

  it("keeps all 6 studio looks with full-gate indices first", () => {
    const planned = [
      look("Estate"),
      look("Club"),
      look("Club"),
      look("Estate"),
      look("Club"),
      look("Club"),
    ];
    const products = [
      { products: withBlazer },
      { products: topBottom },
      { products: topBottom },
      { products: withBlazer },
      { products: topBottom },
      { products: topBottom },
    ];
    expect(selectLooksForBoard(planned, products, "old money")).toEqual([
      0, 3, 1, 2, 4, 5,
    ]);
  });

  it("does not keep a dress-centric look that only has top/bottom products", () => {
    expect(
      selectLooksForBoard([dressLook], [{ products: topBottom }])
    ).toEqual([]);
  });

  it("keeps a dress-centric look that has a shoppable dress", () => {
    const dress = [product({ title: "Floral Midi", matchCategory: "dress" })];
    expect(selectLooksForBoard([dressLook], [{ products: dress }])).toEqual([0]);
  });
});

describe("boardFailureReason", () => {
  it("returns shop when no verified products exist", () => {
    expect(
      boardFailureReason({
        totalVerified: 0,
        keptLooks: 0,
        refsAfterFinalize: 0,
      })
    ).toBe("shop");
  });

  it("maps empty keep to the shop string, not the photo string", () => {
    const reason = boardFailureReason({
      totalVerified: 4,
      keptLooks: 0,
      refsAfterFinalize: 0,
    });
    expect(reason).toBe("shop");
    expect(boardFailCopy(reason)).toBe(SHOP_FAIL);
    expect(boardFailCopy(reason)).not.toBe(PHOTOS_FAIL);
  });

  it("maps non-empty keep and zero refs to the photo string", () => {
    const reason = boardFailureReason({
      totalVerified: 4,
      keptLooks: 2,
      refsAfterFinalize: 0,
    });
    expect(reason).toBe("photos");
    expect(boardFailCopy(reason)).toBe(PHOTOS_FAIL);
    expect(boardFailCopy(reason)).not.toBe(SHOP_FAIL);
  });

  it("returns null when kept looks still have image refs", () => {
    expect(
      boardFailureReason({
        totalVerified: 4,
        keptLooks: 2,
        refsAfterFinalize: 3,
      })
    ).toBe(null);
  });
});

describe("decideOnlineEmptyRefsOutcome", () => {
  it("completes without a board when shoppable looks remain and refs are empty", () => {
    const shirt = product({ title: "Navy shirt", matchCategory: "top" });
    expect(
      decideOnlineEmptyRefsOutcome({
        boardPlan: [look("Office")],
        looksProducts: [{ products: [shirt] }],
        totalVerified: 1,
        keptLooks: 1,
        refsAfterFinalize: 0,
      })
    ).toEqual({ type: "complete-without-board" });
  });

  it("fails with shop vs photos mapping when the board plan is empty", () => {
    expect(
      decideOnlineEmptyRefsOutcome({
        boardPlan: [],
        looksProducts: [],
        totalVerified: 0,
        keptLooks: 0,
        refsAfterFinalize: 0,
      })
    ).toEqual({
      type: "fail",
      reason: boardFailureReason({
        totalVerified: 0,
        keptLooks: 0,
        refsAfterFinalize: 0,
      }),
    });
    expect(
      decideOnlineEmptyRefsOutcome({
        boardPlan: [],
        looksProducts: [],
        totalVerified: 4,
        keptLooks: 0,
        refsAfterFinalize: 0,
      })
    ).toEqual({
      type: "fail",
      reason: boardFailureReason({
        totalVerified: 4,
        keptLooks: 0,
        refsAfterFinalize: 0,
      }),
    });
    expect(
      decideOnlineEmptyRefsOutcome({
        boardPlan: [],
        looksProducts: [],
        totalVerified: 4,
        keptLooks: 2,
        refsAfterFinalize: 0,
      })
    ).toEqual({
      type: "fail",
      reason: boardFailureReason({
        totalVerified: 4,
        keptLooks: 2,
        refsAfterFinalize: 0,
      }),
    });
  });
});

describe("prefetchProductImageUrls", () => {
  it("warns ok vs failed when any fetch fails and does not put ? in the log", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await prefetchProductImageUrls([
        "http://127.0.0.1/blocked.jpg?token=secret",
        "http://localhost/also-blocked.jpg",
      ]);
      const logs = warn.mock.calls
        .map((c) => String(c[0]))
        .filter((m) => m.includes("[prefetchProductImageUrls]"));
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0]).toMatch(/ok=\d+ failed=\d+/);
      expect(logs[0]).not.toContain("?");
    } finally {
      warn.mockRestore();
    }
  });
});

describe("buildSimpleFallbackLook", () => {
  it("uses an old_money template with outerwear and not a polo-first top", () => {
    const planned = buildSimpleFallbackLook(0, "old money", "men", "old_money");
    expect(
      planned.items?.some((it) => it.category === "outerwear")
    ).toBe(true);
    const top = planned.items?.find((it) => it.category === "top");
    expect(top?.searchQuery).not.toMatch(/polo|tshirt|t-shirt|\btee\b/i);
    expect(top?.searchQuery).toMatch(/oxford|linen/i);
  });
});
