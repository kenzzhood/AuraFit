import type { AccessoryType, CatalogItem, CharacterItem } from "@/stall/types";

export type Cart = {
  top: CatalogItem | null;
  pant: CatalogItem | null;
  coat: CatalogItem | null;
  accessories: CatalogItem[];
};

export const EMPTY_CART: Cart = {
  top: null,
  pant: null,
  coat: null,
  accessories: [],
};

export const MAX_ACCESSORIES = 3;

export type CartEffect = "added" | "replaced" | "rejected";

export type CartResult = {
  cart: Cart;
  message: string | null;
  effect: CartEffect;
  slot: string;
};

const ACCESSORY_LABEL: Record<AccessoryType, string> = {
  necklace: "necklace",
  watch: "watch",
  shoe: "shoes",
  hat: "hat",
};

export function addProduct(cart: Cart, item: CatalogItem): CartResult {
  if (item.category === "tops") {
    const replaced = cart.top != null && cart.top.id !== item.id;
    return {
      cart: { ...cart, top: item },
      message: replaced ? "Replaced your top" : null,
      effect: replaced ? "replaced" : "added",
      slot: "top",
    };
  }
  if (item.category === "pants") {
    const replaced = cart.pant != null && cart.pant.id !== item.id;
    return {
      cart: { ...cart, pant: item },
      message: replaced ? "Replaced your pants" : null,
      effect: replaced ? "replaced" : "added",
      slot: "pant",
    };
  }
  if (item.category === "coats") {
    const replaced = cart.coat != null && cart.coat.id !== item.id;
    return {
      cart: { ...cart, coat: item },
      message: replaced ? "Replaced your jacket" : null,
      effect: replaced ? "replaced" : "added",
      slot: "coat",
    };
  }
  const type = item.accessoryType;
  if (!type) {
    return {
      cart,
      message: "That accessory does not fit a slot",
      effect: "rejected",
      slot: "accessories",
    };
  }
  const index = cart.accessories.findIndex((a) => a.accessoryType === type);
  if (index >= 0) {
    if (cart.accessories[index].id === item.id) {
      return { cart, message: null, effect: "added", slot: `acc-${type}` };
    }
    const next = cart.accessories.slice();
    next[index] = item;
    return {
      cart: { ...cart, accessories: next },
      message: `Swapped your ${ACCESSORY_LABEL[type]}`,
      effect: "replaced",
      slot: `acc-${type}`,
    };
  }
  if (cart.accessories.length >= MAX_ACCESSORIES) {
    return {
      cart,
      message: "Three accessories max. Take one out first.",
      effect: "rejected",
      slot: "accessories",
    };
  }
  return {
    cart: { ...cart, accessories: [...cart.accessories, item] },
    message: null,
    effect: "added",
    slot: `acc-${type}`,
  };
}

export function removeProduct(cart: Cart, id: string): Cart {
  return {
    top: cart.top?.id === id ? null : cart.top,
    pant: cart.pant?.id === id ? null : cart.pant,
    coat: cart.coat?.id === id ? null : cart.coat,
    accessories: cart.accessories.filter((item) => item.id !== id),
  };
}

export function cartProducts(cart: Cart): CatalogItem[] {
  return [cart.top, cart.pant, cart.coat, ...cart.accessories].filter(
    (item): item is CatalogItem => item != null
  );
}

export function cartIsEmpty(cart: Cart): boolean {
  return cartProducts(cart).length === 0;
}

export function addCharacter(
  current: CharacterItem | null,
  next: CharacterItem
): { character: CharacterItem; message: string | null; effect: "added" | "replaced" } {
  if (current && current.id !== next.id) {
    return {
      character: next,
      message: `Now trying ${next.name}`,
      effect: "replaced",
    };
  }
  return { character: next, message: null, effect: "added" };
}
