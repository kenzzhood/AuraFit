import type { Metadata } from "next";
import { LegalDoc } from "@/components/legal/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Aurafit processes account data, photos, and optional product analytics (Google Analytics, Microsoft Clarity, Mixpanel, PostHog). DPDP contact: support@aurafit.app.",
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalDoc title="Privacy Policy">
      <p>
        We process account data (email via Clerk), uploaded photos, style
        preferences, generation job metadata, billing identifiers, and product
        interaction analytics to operate Aurafit.
      </p>
      <p>
        <strong className="text-aura-foreground">Processors.</strong> Auth (Clerk),
        payments (Razorpay / app stores), hosting (Azure), media storage, and AI
        providers process data under their terms to deliver the service. We do not
        sell personal data.
      </p>
      <p>
        <strong className="text-aura-foreground">Optional analytics.</strong> With
        your Accept choice, Aurafit may use Google Analytics, Microsoft Clarity,
        Mixpanel, and PostHog for product analytics (usage, performance, and UX
        improvement). Reject keeps these off. Auth/session cookies remain either
        way. You can change your choice anytime via Cookie settings in the site
        footer (or reopen the consent bar).
      </p>
      <p>
        Photos and wardrobe images are used to generate styling results. Do not
        upload images of others without permission. Retention follows operational
        need and legal requirements; you may request deletion of account data
        subject to billing/fraud retention.
      </p>
      <p>
        Payments: we store plan status, transaction references, and ledger entries —
        not full card numbers (handled by the payment provider).
      </p>
      <p>
        Contact support@aurafit.app for privacy requests (access, correction,
        deletion) under applicable law including the Indian DPDP Act where
        relevant.
      </p>
    </LegalDoc>
  );
}
