import type { PublicLook } from "@/modules/shared/types";
import { waMeLink } from "@/modules/whatsapp";

export interface ProductPage {
  storeId: string;
  styleId: string;
  title: string;
  titleTa: string;
  priceInr: number;
  fabric: string;
  care: string;
  availabilityText: string;
  location: string;
  address: string;
  hours: string;
  orderUrl: string;
  payEnabled: false;
}

export function buildProductPage(input: {
  storeId: string;
  storeName: string;
  storeWhatsapp: string;
  address: string;
  hours: string;
  look: PublicLook;
}): ProductPage {
  return {
    storeId: input.storeId,
    styleId: input.look.id,
    title: input.look.name,
    titleTa: input.look.nameTa,
    priceInr: input.look.priceInr,
    fabric: input.look.fabric,
    care: input.look.care,
    availabilityText: input.look.availabilityText,
    location: input.look.location,
    address: input.address,
    hours: input.hours,
    orderUrl: waMeLink(
      input.storeWhatsapp,
      `Order ${input.look.name} (${input.look.id}) from ${input.storeName}`
    ),
    payEnabled: false,
  };
}

export function readStorefrontConfig(env: Record<string, string | undefined> = process.env) {
  return {
    storeWhatsapp: env.AURAFIT_STORE_WHATSAPP ?? "919840011111",
    payments: false as const,
  };
}
