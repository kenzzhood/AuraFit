import type { StylistProductCard } from "@/lib/ai/stylist-events";
import type { GenerationLookResult } from "@/types/generation";

export type StylistToolContext = {
  userId: string;
  conversationId: string;
  imageUrls?: string[];
};

export type StylistToolResult = {
  ok: boolean;
  message: string;
  jobId?: string;
  status?: "queued" | "done";
  products?: StylistProductCard[];
  looks?: Array<{
    label?: string;
    tagline?: string;
    description?: string;
    products?: Array<{ title?: string; matchCategory?: string }>;
  }>;
  lastLooks?: GenerationLookResult[];
  boardImageUrl?: string;
  error?: string;
  code?: string;
  needPhoto?: boolean;
};

export type StylistToolHandler = (
  ctx: StylistToolContext,
  args: Record<string, unknown>
) => Promise<StylistToolResult>;
