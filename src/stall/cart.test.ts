import { describe, expect, it } from "vitest";
import { addCharacter, addProduct, EMPTY_CART, removeProduct } from "@/stall/cart";
import type { CatalogItem, CharacterItem } from "@/stall/types";

function item(partial: Partial<CatalogItem> & Pick<CatalogItem, "id" | "category">): CatalogItem {
  return {
    title: partial.id,
    brand: "Brand",
    priceInr: 999,
    mrpInr: null,
    url: "https://www.myntra.com/p",
    image: "/catalog/images/x.jpg",
    store: "myntra",
    gender: "women",
    accessoryType: null,
    color: null,
    style: "casual",
    ...partial,
  };
}

const hero: CharacterItem = {
  id: "eren-yeager",
  name: "Eren Yeager",
  series: "Attack on Titan",
  look: "brown jacket",
  hair: "short brown",
  image: "/characters/anime/eren-yeager.jpg",
  group: "anime",
};

describe("cart limits", () => {
  it("keeps one top, one pant and one jacket, replacing the previous", () => {
    let cart = EMPTY_CART;
    cart = addProduct(cart, item({ id: "dress", category: "tops" })).cart;
    const replaced = addProduct(cart, item({ id: "shirt", category: "tops" }));
    expect(replaced.cart.top?.id).toBe("shirt");
    expect(replaced.effect).toBe("replaced");
    cart = addProduct(replaced.cart, item({ id: "jean", category: "bottoms" })).cart;
    cart = addProduct(cart, item({ id: "gown", category: "dresses" })).cart;
    cart = addProduct(cart, item({ id: "jacket", category: "coats" })).cart;
    expect(cart.pant?.id).toBe("jean");
    expect(cart.dress?.id).toBe("gown");
    expect(cart.coat?.id).toBe("jacket");
    const nextDress = addProduct(cart, item({ id: "saree", category: "dresses" }));
    expect(nextDress.effect).toBe("replaced");
    expect(nextDress.cart.dress?.id).toBe("saree");
  });

  it("allows up to three accessories and only one of each type", () => {
    let cart = EMPTY_CART;
    for (const [id, accessoryType] of [
      ["n", "necklace"],
      ["w", "watch"],
      ["s", "shoe"],
    ] as const) {
      cart = addProduct(cart, item({ id, category: "accessories", accessoryType })).cart;
    }
    expect(cart.accessories).toHaveLength(3);
    const blocked = addProduct(
      cart,
      item({ id: "h", category: "accessories", accessoryType: "hat" })
    );
    expect(blocked.effect).toBe("rejected");
    expect(blocked.cart.accessories).toHaveLength(3);
    const swapped = addProduct(
      cart,
      item({ id: "w2", category: "accessories", accessoryType: "watch" })
    );
    expect(swapped.effect).toBe("replaced");
    expect(swapped.cart.accessories.map((entry) => entry.id)).toEqual(["n", "w2", "s"]);
  });

  it("removes a piece and swaps characters one at a time", () => {
    const cart = addProduct(EMPTY_CART, item({ id: "dress", category: "tops" })).cart;
    expect(removeProduct(cart, "dress").top).toBeNull();
    const first = addCharacter(null, hero);
    const second = addCharacter(first.character, { ...hero, id: "levi-ackerman", name: "Levi Ackerman" });
    expect(second.effect).toBe("replaced");
    expect(second.character.name).toBe("Levi Ackerman");
  });
});
