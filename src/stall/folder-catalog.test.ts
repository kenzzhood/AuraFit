import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadCatalogFrom, loadCharactersFrom, safePublicImage } from "@/stall/folder-catalog";

const roots: string[] = [];

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "autofit-catalog-"));
  roots.push(root);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function writeItem(dir: string, name: string, image: string, extra: Record<string, unknown> = {}) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, image), "image");
  const item = {
    id: name,
    title: name,
    brand: "Roadster",
    priceInr: 1299,
    mrpInr: 1999,
    url: "https://www.myntra.com/example/buy",
    image,
    store: "myntra",
    gender: "women",
    style: "casual",
    color: "Black",
    ...extra,
  };
  fs.writeFileSync(path.join(dir, "items.json"), JSON.stringify({ items: [item] }));
}

describe("folder catalog", () => {
  it("loads each category folder and skips the template and missing images", () => {
    const root = makeRoot();
    const tops = path.join(root, "catalog", "tops");
    writeItem(tops, "linen-shirt", "linen-shirt.jpg", { style: "old-money", gender: "men" });
    fs.writeFileSync(
      path.join(tops, "_template.json"),
      JSON.stringify({
        id: "example-id",
        title: "Product title",
        image: "your-photo.jpg",
        url: "https://www.myntra.com/example",
        store: "myntra",
        priceInr: 1,
        style: "casual",
      })
    );
    fs.writeFileSync(
      path.join(tops, "broken.json"),
      JSON.stringify({
        id: "ghost",
        title: "Missing photo",
        image: "missing.jpg",
        url: "https://www.myntra.com/example",
        store: "myntra",
        priceInr: 10,
        style: "casual",
      })
    );
    const watches = path.join(root, "catalog", "accessories", "watches");
    writeItem(watches, "gold-watch", "gold-watch.jpg", { style: "formal", gender: "unisex" });

    const catalog = loadCatalogFrom(root);
    expect(catalog.items.map((item) => item.id).sort()).toEqual(["gold-watch", "linen-shirt"]);
    const shirt = catalog.items.find((item) => item.id === "linen-shirt");
    expect(shirt?.category).toBe("tops");
    expect(shirt?.style).toBe("old-money");
    expect(shirt?.image).toBe("/catalog/tops/linen-shirt.jpg");
    const watch = catalog.items.find((item) => item.id === "gold-watch");
    expect(watch?.category).toBe("accessories");
    expect(watch?.accessoryType).toBe("watch");
    expect(safePublicImage("/catalog/tops/linen-shirt.jpg", root)).toBe(
      path.join(tops, "linen-shirt.jpg")
    );
    expect(safePublicImage("/catalog/tops/../watches/gold-watch.jpg", root)).toBeNull();
  });

  it("loads one JSON file per item and separates anime from games", () => {
    const root = makeRoot();
    const anime = path.join(root, "characters", "anime");
    const games = path.join(root, "characters", "games");
    fs.mkdirSync(anime, { recursive: true });
    fs.mkdirSync(games, { recursive: true });
    fs.writeFileSync(path.join(anime, "naruto.jpg"), "image");
    fs.writeFileSync(path.join(games, "mario.png"), "image");
    fs.writeFileSync(
      path.join(anime, "naruto.json"),
      JSON.stringify({
        id: "naruto",
        name: "Naruto Uzumaki",
        series: "Naruto",
        look: "orange jacket",
        hair: "spiky blond hair",
        image: "naruto.jpg",
      })
    );
    fs.writeFileSync(
      path.join(games, "items.json"),
      JSON.stringify([
        {
          id: "mario",
          name: "Mario",
          series: "Super Mario",
          look: "red cap and blue overalls",
          hair: "brown hair under a red cap",
          image: "mario.png",
        },
      ])
    );
    const characters = loadCharactersFrom(root);
    expect(characters.items).toEqual([
      expect.objectContaining({ id: "naruto", group: "anime", image: "/characters/anime/naruto.jpg" }),
      expect.objectContaining({ id: "mario", group: "game", image: "/characters/games/mario.png" }),
    ]);
  });
});
