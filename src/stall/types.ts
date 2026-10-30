export type Category = "tops" | "pants" | "coats" | "accessories";
export type AccessoryType = "necklace" | "watch" | "shoe" | "hat";
export type StoreName = "myntra" | "amazon";
export type Gender = "women" | "men" | "unisex" | "unknown";

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
  capturedAt?: string;
};

export type CatalogFile = {
  generatedAt?: string;
  note?: string;
  counts?: Record<string, { myntra?: number; amazon?: number }>;
  total?: number;
  items: CatalogItem[];
};

export type CharacterItem = {
  id: string;
  name: string;
  series: string;
  look: string;
  hair: string;
  image: string;
};

export type CharacterFile = {
  note?: string;
  total?: number;
  items: CharacterItem[];
};

export type StallMode = "style" | "character";
