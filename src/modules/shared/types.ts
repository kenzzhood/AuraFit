/** Shared store-product types. Public shapes never include skin tone, stock counts, or photos. */

export type Audience = "women" | "men" | "child";
export type ForWhom = Audience | "gift";
export type Occasion =
  | "daily"
  | "office"
  | "party"
  | "wedding"
  | "festival"
  | "casual";
export type BudgetBand = "under_1000" | "1000_2500" | "2500_5000" | "5000_plus";
export type AvailabilityLabel = "available" | "likely" | "ask_staff";
export type Language = "en" | "ta";

export interface PublicLook {
  id: string;
  name: string;
  nameTa: string;
  priceInr: number;
  availability: AvailabilityLabel;
  availabilityText: string;
  location: string;
  fabric: string;
  care: string;
  color: string;
  category: string;
  modelOnly: boolean;
  caption: string;
}

export interface Look extends PublicLook {
  audience: Audience;
  occasions: Occasion[];
  budget: BudgetBand;
  priority: number;
  popularity: number;
}

export function availabilityText(label: AvailabilityLabel): string {
  if (label === "available") return "Available";
  if (label === "likely") return "Likely available";
  return "Ask staff";
}

export function budgetForPrice(priceInr: number): BudgetBand {
  if (priceInr < 1000) return "under_1000";
  if (priceInr <= 2500) return "1000_2500";
  if (priceInr <= 5000) return "2500_5000";
  return "5000_plus";
}

export function toPublicLook(look: Look): PublicLook {
  return {
    id: look.id,
    name: look.name,
    nameTa: look.nameTa,
    priceInr: look.priceInr,
    availability: look.availability,
    availabilityText: look.availabilityText,
    location: look.location,
    fabric: look.fabric,
    care: look.care,
    color: look.color,
    category: look.category,
    modelOnly: look.modelOnly,
    caption: "Shown on a model like you",
  };
}
