export const STYLE_OPTIONS = [
  { id: "old-money", label: "Old money" },
  { id: "aesthetic", label: "Aesthetic" },
  { id: "casual", label: "Casual" },
  { id: "formal", label: "Formal" },
  { id: "festive", label: "Grand / ethnic" },
  { id: "streetwear", label: "Streetwear" },
  { id: "y2k", label: "Y2K" },
  { id: "minimalist", label: "Minimalist" },
  { id: "boho", label: "Boho" },
  { id: "party", label: "Party" },
  { id: "sporty", label: "Sporty" },
  { id: "korean", label: "Korean" },
  { id: "vintage", label: "Vintage" },
  { id: "smart-casual", label: "Smart casual" },
] as const;

export type StyleId = (typeof STYLE_OPTIONS)[number]["id"];

export type Category = "tops" | "bottoms" | "coats" | "dresses" | "accessories";
export type AccessoryType = "necklace" | "watch" | "shoe" | "hat";
export type StoreName = "myntra" | "amazon";
export type Gender = "women" | "men" | "unisex" | "unknown";
export type CharacterGroup = "anime" | "game";

export type CatalogItem = {
  id: string;
  title: string;
  brand: string;
  priceInr: number;
  mrpInr: number | null;
  url: string;
  image: string;
  store: StoreName;
  category: Category;
  gender: Gender;
  accessoryType: AccessoryType | null;
  color: string | null;
  style: StyleId;
  capturedAt?: string;
};

export type CatalogFile = {
  items: CatalogItem[];
};

export type CharacterItem = {
  id: string;
  name: string;
  series: string;
  look: string;
  hair: string;
  image: string;
  group: CharacterGroup;
};

export type CharacterFile = {
  items: CharacterItem[];
};

export type StallMode = "style" | "character";
