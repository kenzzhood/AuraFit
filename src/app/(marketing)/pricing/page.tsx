import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { PricingCards } from "@/components/billing/PricingCards";
import {
  listPublicCatalog,
  formatMoney,
  trialDays,
} from "@/lib/billing/catalog";
import { isBillingEnabled } from "@/lib/billing/config";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Aurafit Free, Plus, and Pro — AI styling plans with a short Plus trial. Transparent digital pricing.",
  alternates: { canonical: "/pricing" },
};

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://aurafit-web.blackstone-033a1f17.eastus2.azurecontainerapps.io";

export default async function PricingPage() {
  const { userId } = await auth();
  const items = listPublicCatalog("INR").map((item) => ({
    ...item,
    displayPrice: formatMoney(item.amountMinor, item.currency),
  }));
  const usd = listPublicCatalog("USD")
    .filter((i) => i.key !== "free")
    .map((item) => ({
      ...item,
      displayPrice: formatMoney(item.amountMinor, item.currency),
    }));
  const days = trialDays();

  const offers = [...items, ...usd]
    .filter((i) => i.kind === "subscription")
    .map((i) => ({
      "@type": "Offer",
      name: i.name,
      price: (i.amountMinor / 100).toFixed(i.currency === "INR" ? 0 : 2),
      priceCurrency: i.currency,
      description: i.description,
    }));

  const softwareLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Aurafit",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    url: `${appUrl}/pricing`,
    offers,
  }).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: softwareLd }}
      />
      <LandingHeader />
      <main
        id="main-content"
        className="relative overflow-hidden px-6 pb-24 pt-[100px] md:px-12"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(212,184,150,0.08),_transparent_55%)]" />
        <div className="relative mx-auto max-w-5xl">
          <p className="font-display text-sm text-aura-champagne">Aurafit</p>
          <h1 className="mt-3 font-display text-3xl text-aura-foreground md:text-4xl">
            Pricing
          </h1>
          <p className="mt-4 max-w-xl text-lg text-aura-muted md:text-xl">
            Freemium styling — try Plus free, then pay only if it sticks.
          </p>
          <div className="mt-12">
            <PricingCards
              items={[...items, ...usd]}
              billingEnabled={isBillingEnabled()}
              signedIn={Boolean(userId)}
              trialDays={days}
            />
          </div>
          <nav className="mt-16 flex flex-wrap gap-4 text-xs text-aura-dim">
            <Link href="/" className="hover:text-aura-champagne">
              Home
            </Link>
            <Link href="/legal/privacy" className="hover:text-aura-champagne">
              Privacy
            </Link>
            <Link href="/billing" className="hover:text-aura-champagne">
              Manage billing
            </Link>
          </nav>
        </div>
      </main>
    </>
  );
}
