import { z } from "zod";
import { isAllowedAffiliateUrl } from "@/lib/security/affiliate-url";

export const uploadInitSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  kind: z.enum(["wardrobe", "profile", "outfit_render", "chat"]),
});

export const generateJobSchema = z.object({
  path: z.enum(["online", "wardrobe"]),
  /** Public URL of the user's photo for identity-preserving styling. */
  userPhotoUrl: z.string().url().optional(),
  /** High-level style category (smart casual, formal, etc.). */
  styleType: z.string().optional(),
  occasion: z.string().optional(),
  location: z.string().optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  style: z.string().optional(),
  wardrobeItemIds: z.array(z.string()).optional(),
  /**
   * Sub-mode when `path === "wardrobe"`:
   *   - "mix"  : six looks built entirely from the closet (no online discovery)
   *   - "pair" : selected items anchor every look; online products fill the rest
   * Ignored for `path === "online"`.
   */
  wardrobeMode: z.enum(["mix", "pair"]).optional(),
  /** When true, skip expensive board image generation (fast preview). */
  previewOnly: z.boolean().optional(),
  /** Explicit render stage: preview (no board), medium (lower-cost board), hd (full board). */
  renderQuality: z.enum(["preview", "medium", "hd"]).optional(),
  lookCount: z.union([z.literal(2), z.literal(3), z.literal(6)]).optional(),
  source: z.enum(["chat", "generate"]).optional(),
  conversationId: z.string().optional(),
});

const httpsUrl = z
  .string()
  .url()
  .refine((u) => u.startsWith("https://"), "must be https");

export const chatMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(8000),
  imageUrls: z.array(httpsUrl).max(4).optional(),
});

export const affiliateSchema = z.object({
  targetUrl: z
    .string()
    .url()
    .refine(isAllowedAffiliateUrl, "targetUrl must be an https retailer URL"),
  source: z.string(),
  outfitId: z.string().optional(),
  productCacheId: z.string().optional(),
});
