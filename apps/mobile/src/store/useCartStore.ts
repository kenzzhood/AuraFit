import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  addCartItem,
  addOutfitToCart,
  clearCart as clearCartApi,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
  AuthRequiredError,
} from "../api/client";
import { mmkvCartStorage } from "./mmkvCartStorage";

export type MobileCartItem = {
  id: string;
  productCacheId?: string | null;
  outfitId?: string | null;
  outfitLabel?: string | null;
  title: string;
  imageUrl?: string | null;
  productUrl: string;
  affiliateUrl?: string | null;
  effectiveUrl: string;
  retailer?: string | null;
  price?: number | null;
  currency: string;
  category?: string | null;
  quantity: number;
  addedAt: string;
};

export type CartItemInput = {
  productCacheId?: string;
  outfitId?: string;
  outfitLabel?: string;
  title: string;
  imageUrl?: string;
  productUrl: string;
  retailer?: string;
  price?: number;
  currency?: string;
  category?: string;
  quantity?: number;
};

type CartState = {
  items: MobileCartItem[];
  count: number;
  subtotal: number;
  currency: string;
  isLoading: boolean;
  error: string | null;
  fetchCart: () => Promise<void>;
  addItem: (input: CartItemInput) => Promise<void>;
  addOutfit: (
    outfitId: string | undefined,
    label: string,
    products: CartItemInput[]
  ) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  mergeLocalCart: () => Promise<void>;
};

function tempId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function inputToLocalItem(input: CartItemInput): MobileCartItem {
  return {
    id: tempId(),
    productCacheId: input.productCacheId ?? null,
    outfitId: input.outfitId ?? null,
    outfitLabel: input.outfitLabel ?? null,
    title: input.title,
    imageUrl: input.imageUrl ?? null,
    productUrl: input.productUrl,
    affiliateUrl: null,
    effectiveUrl: input.productUrl,
    retailer: input.retailer ?? null,
    price: input.price ?? null,
    currency: input.currency ?? "INR",
    category: input.category ?? null,
    quantity: input.quantity ?? 1,
    addedAt: new Date().toISOString(),
  };
}

function applyServerCart(
  cart: Awaited<ReturnType<typeof getCart>>
): Partial<CartState> {
  return {
    items: cart.items,
    count: cart.itemCount,
    subtotal: cart.subtotal,
    currency: cart.currency,
    isLoading: false,
    error: null,
  };
}

function recomputeLocal(items: MobileCartItem[]): Pick<CartState, "count" | "subtotal"> {
  return {
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: items.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0),
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      count: 0,
      subtotal: 0,
      currency: "INR",
      isLoading: false,
      error: null,

      fetchCart: async () => {
        set({ isLoading: true, error: null });
        try {
          const cart = await getCart();
          set(applyServerCart(cart));
        } catch (e) {
          if (e instanceof AuthRequiredError) {
            set({ isLoading: false });
            return;
          }
          set({
            isLoading: false,
            error: e instanceof Error ? e.message : "Failed to load cart",
          });
        }
      },

      addItem: async (input) => {
        const local = inputToLocalItem(input);
        const items = [local, ...get().items];
        set({ items, ...recomputeLocal(items) });
        try {
          const cart = await addCartItem(input);
          set(applyServerCart(cart));
        } catch (e) {
          if (e instanceof AuthRequiredError) return;
          set({
            items: get().items.filter((i) => i.id !== local.id),
            ...recomputeLocal(get().items.filter((i) => i.id !== local.id)),
            error: e instanceof Error ? e.message : "Could not add item",
          });
        }
      },

      addOutfit: async (outfitId, label, products) => {
        const locals = products.map((p) =>
          inputToLocalItem({
            ...p,
            outfitId: p.outfitId ?? outfitId,
            outfitLabel: p.outfitLabel ?? label,
          })
        );
        const items = [...locals, ...get().items];
        set({ items, ...recomputeLocal(items) });
        try {
          const cart = await addOutfitToCart({
            outfitId,
            outfitLabel: label,
            lookProducts: products.map((p) => ({
              ...p,
              outfitId: p.outfitId ?? outfitId,
              outfitLabel: p.outfitLabel ?? label,
            })),
          });
          set(applyServerCart(cart));
        } catch (e) {
          if (e instanceof AuthRequiredError) return;
          const prevIds = new Set(locals.map((l) => l.id));
          const restored = get().items.filter((i) => !prevIds.has(i.id));
          set({
            items: restored,
            ...recomputeLocal(restored),
            error: e instanceof Error ? e.message : "Could not add outfit",
          });
        }
      },

      removeItem: async (id) => {
        const prev = get().items;
        const items = prev.filter((i) => i.id !== id);
        set({ items, ...recomputeLocal(items) });
        if (id.startsWith("local_")) return;
        try {
          const cart = await removeCartItem(id);
          set(applyServerCart(cart));
        } catch (e) {
          if (e instanceof AuthRequiredError) return;
          set({ items: prev, ...recomputeLocal(prev) });
        }
      },

      updateQuantity: async (id, quantity) => {
        const prev = get().items;
        const items = prev.map((i) =>
          i.id === id ? { ...i, quantity } : i
        );
        set({ items, ...recomputeLocal(items) });
        if (id.startsWith("local_")) return;
        try {
          const cart = await updateCartItemQuantity(id, quantity);
          set(applyServerCart(cart));
        } catch (e) {
          if (e instanceof AuthRequiredError) return;
          set({ items: prev, ...recomputeLocal(prev) });
        }
      },

      clearCart: async () => {
        const prev = get().items;
        set({ items: [], count: 0, subtotal: 0 });
        try {
          await clearCartApi();
        } catch (e) {
          if (e instanceof AuthRequiredError) {
            return;
          }
          set({ items: prev, ...recomputeLocal(prev) });
        }
      },

      mergeLocalCart: async () => {
        const localItems = get().items.filter((i) => i.id.startsWith("local_"));
        if (localItems.length === 0) {
          await get().fetchCart();
          return;
        }
        try {
          for (const item of localItems) {
            await addCartItem({
              productCacheId: item.productCacheId ?? undefined,
              outfitId: item.outfitId ?? undefined,
              outfitLabel: item.outfitLabel ?? undefined,
              title: item.title,
              imageUrl: item.imageUrl ?? undefined,
              productUrl: item.productUrl,
              retailer: item.retailer ?? undefined,
              price: item.price ?? undefined,
              currency: item.currency,
              category: item.category ?? undefined,
              quantity: item.quantity,
            });
          }
          await get().fetchCart();
        } catch {
          /* keep local items if merge fails */
        }
      },
    }),
    {
      name: "cart-items",
      storage: createJSONStorage(() => mmkvCartStorage),
      partialize: (state) => ({
        items: state.items,
        count: state.count,
        subtotal: state.subtotal,
        currency: state.currency,
      }),
    }
  )
);
