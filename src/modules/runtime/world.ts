import {
  availabilityText,
  budgetForPrice,
  type Audience,
  type Look,
  type Occasion,
} from "@/modules/shared/types";
import { createPhotoStore, type PhotoStore } from "@/modules/vision";
import type { StaffAlert } from "@/modules/staff";
import type { SessionEvent } from "@/modules/dashboard";
import type { AuditEvent } from "@/modules/platform";
import type { ConsentRecord } from "@/modules/whatsapp";
import type { IdleAd } from "@/modules/ads";
import type { StoreTenant } from "@/modules/admin";
import { createLimiter } from "@/modules/platform";
import extras from "@/modules/catalog/extras.json";

export const STORE = {
  id: "anna-nagar",
  name: "Kasavu & Co",
  area: "Anna Nagar, Chennai",
  hours: "10:00–21:00",
  whatsapp: "919840011111",
  aurafitWhatsapp: "919999000000",
};

export interface StoreWorld {
  looks: Look[];
  photos: PhotoStore;
  alerts: StaffAlert[];
  events: SessionEvent[];
  audit: AuditEvent[];
  consents: ConsentRecord[];
  ads: IdleAd[];
  tenants: StoreTenant[];
  shares: { code: string; lookIds: string[]; at: number }[];
  zones: { zoneId: string; hour: string; count: number }[];
  seq: number;
  limiter: ReturnType<typeof createLimiter>;
  config: {
    tryOnDelayMs: number;
    quotaRemaining: number;
  };
}

function look(
  partial: Pick<Look, "id" | "name" | "nameTa" | "priceInr" | "color" | "audience" | "occasions" | "category" | "fabric"> &
    Partial<Look>
): Look {
  const availability = partial.availability ?? "available";
  return {
    care: partial.care ?? "Cool iron",
    location: partial.location ?? "Floor 1 · Ethnic · Rack W3",
    modelOnly: partial.modelOnly ?? partial.audience === "child",
    caption: "Shown on a model like you",
    image: partial.image ?? `/catalog/${partial.id}.svg`,
    budget: budgetForPrice(partial.priceInr),
    priority: partial.priority ?? 0,
    popularity: partial.popularity ?? 1,
    availability,
    availabilityText: availabilityText(availability),
    ...partial,
  };
}

export function seedLooks(): Look[] {
  const women = "women" as Audience;
  const men = "men" as Audience;
  const child = "child" as Audience;
  const wedding: Occasion[] = ["wedding"];
  const office: Occasion[] = ["office"];
  const daily: Occasion[] = ["daily"];
  return [
    look({ id: "kanjivaram", name: "Kanjivaram silk saree", nameTa: "காஞ்சிவரம் பட்டு புடவை", priceInr: 18900, color: "maroon", audience: women, occasions: wedding, category: "saree", fabric: "Silk", popularity: 6, care: "Dry clean" }),
    look({ id: "banarasi", name: "Banarasi saree", nameTa: "பனாரசி புடவை", priceInr: 21000, color: "ivory", audience: women, occasions: wedding, category: "saree", fabric: "Silk", popularity: 4 }),
    look({ id: "temple", name: "Temple border saree", nameTa: "கோவில் பார்டர் புடவை", priceInr: 15400, color: "green", audience: women, occasions: wedding, category: "saree", fabric: "Silk", popularity: 3 }),
    look({ id: "lehenga", name: "Reception lehenga", nameTa: "லெஹங்கா", priceInr: 32000, color: "maroon", audience: women, occasions: wedding, category: "lehenga", fabric: "Silk", priority: 1, popularity: 5 }),
    look({ id: "gown", name: "Evening gown", nameTa: "மாலை கவுன்", priceInr: 24000, color: "black", audience: women, occasions: wedding, category: "gown", fabric: "Georgette", popularity: 2 }),
    look({ id: "blouse-set", name: "Silk blouse set", nameTa: "பட்டு பிளவுஸ் செட்", priceInr: 9800, color: "sand", audience: women, occasions: wedding, category: "blouse", fabric: "Silk", popularity: 2 }),
    look({ id: "missing-saree", name: "Tissue saree", nameTa: "திசு புடவை", priceInr: 12000, color: "ivory", audience: women, occasions: wedding, category: "saree", fabric: "Tissue", availability: "ask_staff", popularity: 9 }),
    look({ id: "blue-kurta", name: "Indigo kurta set", nameTa: "இண்டிகோ குர்த்தா", priceInr: 2100, color: "indigo", audience: women, occasions: office, category: "kurta", fabric: "Cotton", popularity: 8, location: "Floor 1 · Workwear · Rack A2" }),
    look({ id: "sand-kurta", name: "Sand cotton kurta", nameTa: "மணல் நிற குர்த்தா", priceInr: 1800, color: "sand", audience: women, occasions: office, category: "kurta", fabric: "Cotton", popularity: 3 }),
    look({ id: "green-saree", name: "Office cotton saree", nameTa: "அலுவலக புடவை", priceInr: 2300, color: "green", audience: women, occasions: office, category: "saree", fabric: "Cotton", popularity: 2 }),
    look({ id: "formal-set", name: "Formal co-ord", nameTa: "ஃபார்மல் செட்", priceInr: 2490, color: "indigo", audience: women, occasions: office, category: "coord", fabric: "Linen", popularity: 2 }),
    look({ id: "palazzo", name: "Maroon palazzo set", nameTa: "பலாசோ செட்", priceInr: 1600, color: "maroon", audience: women, occasions: office, category: "kurta", fabric: "Cotton", popularity: 1 }),
    look({ id: "ivory-shirt", name: "Ivory office shirt", nameTa: "ஐவரி சட்டை", priceInr: 1990, color: "ivory", audience: women, occasions: office, category: "shirt", fabric: "Cotton", popularity: 1 }),
    look({ id: "bandhgala", name: "Black bandhgala", nameTa: "பேண்ட்கலா", priceInr: 14900, color: "black", audience: men, occasions: wedding, category: "bandhgala", fabric: "Wool blend", popularity: 4, location: "Floor 2 · Men · Rack M1" }),
    look({ id: "sherwani", name: "Maroon sherwani", nameTa: "ஷெர்வானி", priceInr: 22000, color: "maroon", audience: men, occasions: wedding, category: "sherwani", fabric: "Silk", popularity: 5, location: "Floor 2 · Men · Rack M1" }),
    look({ id: "silk-shirt", name: "Ivory silk shirt", nameTa: "பட்டு சட்டை", priceInr: 8900, color: "ivory", audience: men, occasions: wedding, category: "shirt", fabric: "Silk", popularity: 2, location: "Floor 2 · Men · Rack M2" }),
    look({ id: "frock", name: "Cotton frock", nameTa: "பருத்தி ஃபிராக்", priceInr: 1490, color: "ivory", audience: child, occasions: daily, category: "frock", fabric: "Cotton", modelOnly: true, popularity: 3, location: "Floor 1 · Kids · Rack K1" }),
    look({ id: "kids-set", name: "Green cotton set", nameTa: "பச்சை குழந்தை செட்", priceInr: 1800, color: "green", audience: child, occasions: daily, category: "set", fabric: "Cotton", modelOnly: true, popularity: 2, location: "Floor 1 · Kids · Rack K1" }),
    look({ id: "kids-kurta", name: "Sand kids kurta", nameTa: "குழந்தை குர்த்தா", priceInr: 1290, color: "sand", audience: child, occasions: daily, category: "kurta", fabric: "Cotton", modelOnly: true, popularity: 2, location: "Floor 1 · Kids · Rack K2" }),
    look({ id: "swim", name: "Resort swim set", nameTa: "நீச்சல் உடை", priceInr: 3999, color: "indigo", audience: women, occasions: ["party"], category: "swimwear", fabric: "Nylon", modelOnly: true, popularity: 1 }),
    ...extras.map((item) =>
      look({
        id: item.id,
        name: item.name,
        nameTa: item.nameTa,
        priceInr: item.priceInr,
        color: item.color,
        audience: item.audience as Audience,
        occasions: item.occasions as Occasion[],
        category: item.category,
        fabric: item.fabric,
        location: item.location,
        popularity: item.popularity,
        modelOnly: item.audience === "child",
      })
    ),
  ];
}

export function createDemoWorld(options?: { tryOnDelayMs?: number }): StoreWorld {
  return {
    looks: seedLooks(),
    photos: createPhotoStore(),
    alerts: [],
    events: [
      { type: "look_shown", styleId: "blue-kurta", sessionId: "past-1", at: 1 },
      { type: "look_opened", styleId: "blue-kurta", sessionId: "past-1", at: 2 },
      { type: "look_opened", styleId: "blue-kurta", sessionId: "past-2", at: 3 },
      { type: "sold", styleId: "blue-kurta", sessionId: "past-2", at: 4, source: "barcode" },
    ],
    audit: [],
    consents: [],
    ads: [
      { id: "edit", title: "The wedding edit", titleTa: "திருமணத் தொகுப்பு", kind: "offer" },
      { id: "arrival", title: "New Kanjivaram", titleTa: "புதிய காஞ்சிவரம்", kind: "arrival" },
      { id: "pongal", title: "Pongal silks", titleTa: "பொங்கல் பட்டு", kind: "festival", months: [1] },
    ],
    tenants: [
      { id: STORE.id, name: STORE.name, brandId: "kasavu", heatmap: true, legalSignOff: true },
      { id: "t-nagar", name: "Kasavu & Co T. Nagar", brandId: "kasavu", heatmap: false, legalSignOff: false },
    ],
    shares: [],
    zones: [
      { zoneId: "entrance", hour: "18", count: 42 },
      { zoneId: "ethnic", hour: "18", count: 31 },
      { zoneId: "workwear", hour: "18", count: 18 },
      { zoneId: "men", hour: "18", count: 14 },
      { zoneId: "kids", hour: "18", count: 9 },
    ],
    seq: 1,
    limiter: createLimiter(),
    config: { tryOnDelayMs: options?.tryOnDelayMs ?? 0, quotaRemaining: 6 },
  };
}

const globalStore = globalThis as typeof globalThis & { __aurafitWorld?: StoreWorld };

export function getWorld(): StoreWorld {
  if (!globalStore.__aurafitWorld) {
    globalStore.__aurafitWorld = createDemoWorld({ tryOnDelayMs: 1600 });
  }
  return globalStore.__aurafitWorld;
}
