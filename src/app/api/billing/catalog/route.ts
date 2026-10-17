import { NextResponse } from "next/server";
import { listPublicCatalog, formatMoney } from "@/lib/billing/catalog";
import { isBillingEnabled } from "@/lib/billing/config";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const currency =
    url.searchParams.get("currency")?.toUpperCase() === "USD" ? "USD" : "INR";
  const items = listPublicCatalog(currency).map((item) => ({
    ...item,
    displayPrice: formatMoney(item.amountMinor, item.currency),
  }));

  return NextResponse.json({
    billingEnabled: isBillingEnabled(),
    currency,
    items,
  });
}
