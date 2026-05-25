import { z } from "zod";

export const uploadInitSchema = z.object({
  fileName: z.string(),
  contentType: z.string(),
  kind: z.enum(["wardrobe", "profile", "outfit_render"]),
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
});

export const chatMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(8000),
});

export const affiliateSchema = z.object({
  targetUrl: z.string().url(),
  source: z.string(),
  outfitId: z.string().optional(),
  productCacheId: z.string().optional(),
});
