export type PersonAnalysis = {
  genderPresentation?: string;
  ageRange?: string;
  skinTone?: string;
  undertones?: string;
  faceShape?: string;
  hairType?: string;
  hairColor?: string;
  hairstyle?: string;
  bodyBuild?: string;
  heightEstimate?: string;
  shoulderWidth?: string;
  currentStyle?: string;
  personalVibe?: string;
  bestSilhouettes?: string[];
  bestColors?: string[];
  identityNotes?: string;
  /** Detailed facial anatomy for image-gen identity lock */
  faceAnatomyNotes?: string;
  /** Eye description */
  eyeDescription?: string;
  /** Skin texture details */
  skinTextureNotes?: string;
  /** Distinctive features */
  distinctiveFeatures?: string;
};

export type LookItemPlan = {
  category: string;
  description: string;
  searchQuery?: string;
  /**
   * When the plan was constrained by a wardrobe context, this points at the
   * specific wardrobe row the model chose for this slot. Mix mode requires
   * it for every slot; Pair mode requires it only for anchored categories.
   */
  wardrobeItemId?: string;
};

export type PlannedLook = {
  label: string;
  tagline?: string;
  description?: string;
  bestFor?: string;
  priceRange?: string;
  productSearchQuery: string;
  items?: LookItemPlan[];
};

export type LookProduct = {
  title?: string;
  productUrl?: string;
  source?: string;
  productCacheId?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  storeName?: string;
  /** Set to true only after the crawler validated the product detail page */
  verified?: boolean;
  /** Canonical detail-page URL (preferred over productUrl when present) */
  canonicalUrl?: string;
  /** "in_stock" | "out_of_stock" | "unknown" */
  availability?: "in_stock" | "out_of_stock" | "unknown";
  /** Outfit-item category this product was resolved for (top, bottom, etc.) */
  matchCategory?: string;
  /** 0–1 confidence score for the item↔product match */
  matchConfidence?: number;
  /**
   * Discriminator for UI rendering:
   *   - "online"   : a live shop link found by product discovery (default)
   *   - "wardrobe" : an item the user already owns; render with a "From your
   *                  wardrobe" pill instead of an affiliate buy button.
   */
  kind?: "online" | "wardrobe";
  /** Set when `kind === "wardrobe"` — the originating WardrobeItem id */
  wardrobeItemId?: string;
  /**
   * ProductSearchSession that produced this slot. Holds the full ranked
   * candidate list (3–8 real options) so the UI can offer "replace this item"
   * via GET /api/products/session/[id] without re-crawling.
   */
  sessionId?: string;
};

export type GenerationLookResult = PlannedLook & {
  imageUrl?: string | null;
  products?: LookProduct[];
};

export type RenderQuality = "preview" | "medium" | "hd";

export type ProviderMeta = {
  degraded?: boolean;
  failures?: Array<{ system: string; provider: string; message: string }>;
  providersUsed?: string[];
};

export type GenerationJobResult = {
  boardImageUrl?: string | null;
  personAnalysis?: PersonAnalysis;
  looks?: GenerationLookResult[];
  outfitId?: string;
  /** @deprecated use renderQuality */
  previewOnly?: boolean;
  renderQuality?: RenderQuality;
  providerMeta?: ProviderMeta;
  /** Poll GET /api/products/session/[id] for enriched products after async crawl */
  productSearchSessionIds?: string[];
};
