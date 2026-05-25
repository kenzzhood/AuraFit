import type {
  PersonAnalysis,
  PlannedLook,
} from "@/types/generation";

export type AnalyzePersonInput = {
  imageUrl: string;
};

/**
 * Constraints derived from the user's closet when `path === "wardrobe"`.
 *
 *   - `mode`: "mix" forces every slot to come from `allowedItems`; "pair"
 *             forces only categories present in `lockedByCategory` and lets
 *             the model shop the rest online.
 *   - `allowedItems`: the universe the model is allowed to pick from. For Mix
 *             this is the entire wardrobe; for Pair it's just the anchors.
 *   - `lockedByCategory`: per-category hard constraint. If a category is
 *             present, the model MUST use one of the listed wardrobe IDs in
 *             that slot (rotating across the 6 looks if 2+ are listed).
 */
export type WardrobeContext = {
  mode: "mix" | "pair";
  allowedItems: Array<{
    id: string;
    category: string;
    description?: string;
  }>;
  lockedByCategory: Record<string, string[]>;
};

export type GenerateLooksInput = {
  path: "online" | "wardrobe";
  styleType?: string;
  occasion?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  style?: string;
  personAnalysis?: PersonAnalysis | null;
  wardrobeSummary?: string;
  wardrobeContext?: WardrobeContext;
};

export type ChatMessageInput = {
  role: string;
  content: string;
};

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  analyzePerson(input: AnalyzePersonInput): Promise<PersonAnalysis | null>;
  generateLooks(input: GenerateLooksInput): Promise<PlannedLook[]>;
  generateChat(messages: ChatMessageInput[]): AsyncIterable<string>;
  generateEmbeddings(text: string): Promise<number[]>;
}
