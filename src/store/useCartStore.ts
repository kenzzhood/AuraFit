"use client";

import { create } from "zustand";
import posthog from "posthog-js";
import type {
  CartItemInput,
  CartItemPublic,
  CartResponse,
  CheckoutResponse,
} from "@/types/cart";

function capture(event: string, props?: Record<string, unknown>) {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.capture(event, props);
  }
}

function tempId() {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function inputToOptimisticItem(input: CartItemInput): CartItemPublic {
  const now = new Date().toISOString();
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
    affiliateNetwork: null,
    price: input.price ?? null,
    currency: input.currency ?? "INR",
    category: input.category ?? null,
    quantity: input.quantity ?? 1,
    addedAt: now,
  };
}

function applyCartResponse(state: CartState, cart: CartResponse): Partial<CartState> {
  return {
    items: cart.items,
    count: cart.itemCount,
    subtotal: cart.subtotal,
    currency: cart.currency,
    byOutfit: cart.byOutfit,
    isLoading: false,
    error: null,
  };
}

type CartState = {
  items: CartItemPublic[];
  count: number;
  subtotal: number;
  currency: string;
  byOutfit: CartResponse["byOutfit"];
  isLoading: boolean;
  error: string | null;
  checkout: CheckoutResponse | null;
  cartToast: string | null;
  dismissCartToast: () => void;
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
  fetchCheckout: () => Promise<CheckoutResponse | null>;
  optimisticAdd: (item: CartItemPublic) => void;
  optimisticRemove: (id: string) => void;
};

function showAddedToast(label: string) {
  return `Added to cart — ${label}`;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  count: 0,
  subtotal: 0,
  currency: "INR",
  byOutfit: [],
  isLoading: false,
  error: null,
  checkout: null,
  cartToast: null,

  dismissCartToast: () => set({ cartToast: null }),

  fetchCart: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/cart");
      if (!res.ok) {
        if (res.status === 401) {
          set({ isLoading: false, items: [], count: 0, subtotal: 0, byOutfit: [] });
          return;
        }
        throw new Error("Failed to load cart");
      }
      const cart = (await res.json()) as CartResponse;
      set(applyCartResponse(get(), cart));
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : "Failed to load cart",
      });
    }
  },

  optimisticAdd: (item) => {
    const items = [item, ...get().items];
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce(
      (sum, i) => sum + (i.price ?? 0) * i.quantity,
      0
    );
    set({ items, count, subtotal });
  },

  optimisticRemove: (id) => {
    const items = get().items.filter((i) => i.id !== id);
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce(
      (sum, i) => sum + (i.price ?? 0) * i.quantity,
      0
    );
    set({ items, count, subtotal });
  },

  addItem: async (input) => {
    const optimistic = inputToOptimisticItem(input);
    get().optimisticAdd(optimistic);
    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "item", item: input }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          set({
            isLoading: false,
            items: [],
            count: 0,
            subtotal: 0,
            byOutfit: [],
            cartToast: "Sign in to save items to your cart",
          });
          get().optimisticRemove(optimistic.id);
          return;
        }
        throw new Error("Could not add to cart");
      }
      const cart = (await res.json()) as CartResponse;
      set({
        ...applyCartResponse(get(), cart),
        cartToast: showAddedToast(input.title),
      });
      capture("add_to_cart", {
        product_id: input.productCacheId,
        outfit_id: input.outfitId,
        retailer: input.retailer,
        price: input.price,
      });
    } catch (e) {
      get().optimisticRemove(optimistic.id);
      set({
        error: e instanceof Error ? e.message : "Could not add to cart",
      });
      throw e;
    }
  },

  addOutfit: async (outfitId, label, products) => {
    const prev = get().items;
    const optimisticItems = products.map((p) =>
      inputToOptimisticItem({
        ...p,
        outfitId: p.outfitId ?? outfitId,
        outfitLabel: p.outfitLabel ?? label,
      })
    );
    set({
      items: [...optimisticItems, ...prev],
      count: get().count + optimisticItems.length,
    });
    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "outfit",
          outfitId,
          outfitLabel: label,
          lookProducts: products.map((p) => ({
            ...p,
            outfitId: p.outfitId ?? outfitId,
            outfitLabel: p.outfitLabel ?? label,
          })),
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          set({
            items: prev,
            count: prev.reduce((n, i) => n + i.quantity, 0),
            subtotal: prev.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0),
            cartToast: "Sign in to save items to your cart",
          });
          return;
        }
        throw new Error("Could not add outfit to cart");
      }
      const cart = (await res.json()) as CartResponse;
      set({
        ...applyCartResponse(get(), cart),
        cartToast: showAddedToast(`${products.length} item${products.length === 1 ? "" : "s"}`),
      });
      capture("add_outfit_to_cart", {
        outfit_id: outfitId,
        item_count: products.length,
      });
    } catch (e) {
      set({ items: prev });
      set({
        error: e instanceof Error ? e.message : "Could not add outfit to cart",
      });
      throw e;
    }
  },

  removeItem: async (id) => {
    const prev = get().items;
    get().optimisticRemove(id);
    try {
      const res = await fetch(`/api/cart/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove item");
      const cart = (await res.json()) as CartResponse;
      set(applyCartResponse(get(), cart));
      capture("remove_from_cart", { product_id: id });
    } catch (e) {
      set({ items: prev });
      set({
        error: e instanceof Error ? e.message : "Could not remove item",
      });
    }
  },

  updateQuantity: async (id, quantity) => {
    const prev = get().items;
    set({
      items: prev.map((i) => (i.id === id ? { ...i, quantity } : i)),
    });
    try {
      const res = await fetch(`/api/cart/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!res.ok) throw new Error("Could not update quantity");
      const cart = (await res.json()) as CartResponse;
      set(applyCartResponse(get(), cart));
    } catch (e) {
      set({ items: prev });
      set({
        error: e instanceof Error ? e.message : "Could not update quantity",
      });
    }
  },

  clearCart: async () => {
    const prev = get().items;
    set({ items: [], count: 0, subtotal: 0, byOutfit: [] });
    try {
      const res = await fetch("/api/cart", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not clear cart");
    } catch (e) {
      set({ items: prev });
      set({
        error: e instanceof Error ? e.message : "Could not clear cart",
      });
    }
  },

  fetchCheckout: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/cart/checkout");
      if (!res.ok) throw new Error("Could not load checkout");
      const checkout = (await res.json()) as CheckoutResponse;
      set({ checkout, isLoading: false });
      return checkout;
    } catch (e) {
      set({
        isLoading: false,
        error: e instanceof Error ? e.message : "Could not load checkout",
      });
      return null;
    }
  },
}));
