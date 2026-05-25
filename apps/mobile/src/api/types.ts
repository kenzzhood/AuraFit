export type PersonAnalysis = {
  genderPresentation?: string;
  ageRange?: string;
  skinTone?: string;
  undertones?: string;
  faceShape?: string;
  hairType?: string;
  hairstyle?: string;
  bodyBuild?: string;
  heightEstimate?: string;
  shoulderWidth?: string;
  currentStyle?: string;
  personalVibe?: string;
  bestSilhouettes?: string[];
  bestColors?: string[];
  identityNotes?: string;
};

export type LookItemPlan = {
  category: string;
  description: string;
  searchQuery?: string;
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
  verified?: boolean;
  canonicalUrl?: string;
  availability?: "in_stock" | "out_of_stock" | "unknown";
  matchCategory?: string;
  matchConfidence?: number;
};

export type GenerationLook = {
  label: string;
  tagline?: string;
  description?: string;
  bestFor?: string;
  priceRange?: string;
  productSearchQuery: string;
  items?: LookItemPlan[];
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
  looks?: GenerationLook[];
  outfitId?: string;
  previewOnly?: boolean;
  renderQuality?: RenderQuality;
  providerMeta?: ProviderMeta;
  productSearchSessionIds?: string[];
};

export type ProductSearchSessionResponse = {
  id: string;
  status: "partial" | "ready" | "failed";
  query: string;
  region: string;
  products: LookProduct[];
  providerMeta?: ProviderMeta;
  generationJobId?: string | null;
};

export type GenerationJobStatus = {
  id: string;
  status: "QUEUED" | "PROCESSING" | "DONE" | "FAILED";
  progress: number;
  result: GenerationJobResult | null;
  error: string | null;
};

export type GenerateInput = {
  path: "online" | "wardrobe";
  userPhotoUrl?: string;
  styleType?: string;
  occasion?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  style?: string;
  wardrobeItemIds?: string[];
  previewOnly?: boolean;
};
