import { describe, expect, it } from "vitest";
import type { PublicLook } from "@/modules/shared/types";
import { buildProductPage, readStorefrontConfig } from "./index";

const look: PublicLook = {
  id: "kanjivaram",
  name: "Kanjivaram saree",
  nameTa: "காஞ்சிவரம்",
  priceInr: 18900,
  availability: "ask_staff",
  availabilityText: "Ask staff",
  location: "Floor 1 · Ethnic · Rack W3",
  fabric: "Silk",
  care: "Dry clean",
  color: "maroon",
  category: "saree",
  modelOnly: false,
  caption: "Shown on a model like you",
};

describe("store product page", () => {
  it("orders on the store WhatsApp and does not take payment or a stock count", () => {
    const page = buildProductPage({
      storeId: "anna-nagar",
      storeName: "Kasavu & Co",
      storeWhatsapp: "919840011111",
      address: "Anna Nagar, Chennai",
      hours: "10:00–21:00",
      look,
    });
    expect(page.payEnabled).toBe(false);
    expect(page.orderUrl).toContain("wa.me/919840011111");
    expect(JSON.stringify(page)).not.toMatch(/qty|stockCount|checkout|razorpay/i);
    expect(readStorefrontConfig({}).payments).toBe(false);
  });
});
