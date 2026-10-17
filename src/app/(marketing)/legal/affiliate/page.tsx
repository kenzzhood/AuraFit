import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata: Metadata = {
  title: "Affiliate Disclosure",
  description:
    "Aurafit may earn commissions from affiliate product links at no extra cost to you.",
  alternates: { canonical: "/legal/affiliate" },
};

export default function AffiliatePage() {
  return (
    <LegalDoc title="Affiliate Disclosure">
      <p>
        Some product links in Aurafit are affiliate links. If you buy through those
        links, Aurafit may earn a commission at no extra cost to you.
      </p>
      <p>
        Affiliate relationships do not change the price you see at the retailer.
        We aim to show relevant products; commissions are not the sole ranking
        factor for every result.
      </p>
      <p>
        Aurafit subscriptions and credit packs are separate from affiliate clothing
        purchases. Paying for Plus/Pro does not mean Aurafit sells you the garments
        shown on a board.
      </p>
    </LegalDoc>
  );
}
