import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Aurafit terms for AI styling tools, digital subscriptions, and third-party retailer links.",
  alternates: { canonical: "/legal/terms" },
};

export default function TermsPage() {
  return (
    <LegalDoc title="Terms of Service">
      <p>
        Aurafit provides AI-assisted personal styling tools (look boards, wardrobe
        helpers, and related digital features). By using Aurafit you agree to these
        Terms.
      </p>
      <p>
        <strong className="text-aura-foreground">Not a clothing merchant.</strong>{" "}
        Aurafit does not sell apparel. Product links may open third-party retailers.
        Purchases of physical goods are contracts between you and those retailers.
      </p>
      <p>
        <strong className="text-aura-foreground">Subscriptions &amp; credits.</strong>{" "}
        Paid plans and credit packs are for digital styling capacity (boards, HD
        renders, limits). Fees are billed by our payment processor (Razorpay on web;
        app-store billing on Android where applicable). Entitlements activate after
        server-side payment confirmation.
      </p>
      <p>
        You must provide accurate account information, not abuse rate limits or
        automation against the service, and not upload unlawful content. We may
        suspend accounts that threaten security or violate these Terms.
      </p>
      <p>
        The service is provided “as is.” AI outputs may be imperfect; always verify
        fit, sizing, and retailer details before purchase. Liability is limited to
        fees you paid to Aurafit in the three months preceding a claim, to the
        extent permitted by applicable law (including Indian consumer protection
        law where it applies).
      </p>
      <p>
        Governing law: India. Contact: support@aurafit.app (or the contact listed
        on the site).
      </p>
    </LegalDoc>
  );
}
