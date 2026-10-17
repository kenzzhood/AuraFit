import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata: Metadata = {
  title: "Refund & Cancellation",
  description:
    "How Aurafit subscription cancellations and digital refunds work.",
  alternates: { canonical: "/legal/refund" },
};

export default function RefundPage() {
  return (
    <LegalDoc title="Refund & Cancellation">
      <p>
        Aurafit subscriptions renew until canceled. You may cancel at period end
        from Billing; access continues until the period ends.
      </p>
      <p>
        <strong className="text-aura-foreground">Digital services.</strong> Because
        boards and HD renders are consumed digital services, unused period
        allowances generally are not refunded after use begins. Unused purchased
        credit packs may be considered for goodwill refunds within 7 days of
        purchase if no credits were consumed — contact support@aurafit.app.
      </p>
      <p>
        Duplicate charges or confirmed processor errors are refunded in full.
        Clothing bought on retailer sites is subject to that retailer&apos;s return
        policy — Aurafit cannot refund retailer purchases.
      </p>
      <p>
        Android in-app purchases follow Google Play refund rules when billing moves
        to Play Billing / RevenueCat.
      </p>
    </LegalDoc>
  );
}
