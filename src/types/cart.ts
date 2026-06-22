import { z } from "zod";

export const cartItemInputSchema = z.object({
  productCacheId: z.string().optional(),
  outfitId: z.string().optional(),
  outfitLabel: z.string().optional(),
  title: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
  productUrl: z.string().url(),
  retailer: z.string().optional(),
  price: z.number().int().optional(),
  currency: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number().int().min(1).max(99).optional(),
});

export type CartItemInput = z.infer<typeof cartItemInputSchema>;

export const addCartItemBodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("item"),
    item: cartItemInputSchema,
  }),
  z.object({
    type: z.literal("outfit"),
    outfitId: z.string().optional(),
    outfitLabel: z.string().optional(),
    lookProducts: z.array(cartItemInputSchema).min(1),
  }),
]);

export type AddCartItemBody = z.infer<typeof addCartItemBodySchema>;

export type CartItemPublic = {
  id: string;
  productCacheId: string | null;
  outfitId: string | null;
  outfitLabel: string | null;
  title: string;
  imageUrl: string | null;
  productUrl: string;
  affiliateUrl: string | null;
  effectiveUrl: string;
  retailer: string | null;
  affiliateNetwork: string | null;
  price: number | null;
  currency: string;
  category: string | null;
  quantity: number;
  addedAt: string;
};

export type CartOutfitGroup = {
  outfitId: string | null;
  outfitLabel: string | null;
  items: CartItemPublic[];
};

export type CartResponse = {
  id: string;
  itemCount: number;
  subtotal: number;
  currency: string;
  items: CartItemPublic[];
  byOutfit: CartOutfitGroup[];
};

export type CheckoutGroup = {
  retailer: string;
  itemCount: number;
  subtotal: number;
  currency: string;
  items: CartItemPublic[];
  openAllUrl: string | null;
};

export type CheckoutResponse = {
  itemCount: number;
  subtotal: number;
  currency: string;
  groups: CheckoutGroup[];
};

export const patchCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(99),
});
