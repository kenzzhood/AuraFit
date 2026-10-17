import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { Hero } from "@/components/landing/Hero";
import { OutfitShowcase } from "@/components/landing/OutfitShowcase";
import { WardrobeDemo } from "@/components/landing/WardrobeDemo";
import { GenerationPreview } from "@/components/landing/GenerationPreview";
import { SocialProof } from "@/components/landing/SocialProof";
import { CookieSettingsButton } from "@/components/analytics/CookieSettingsButton";

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://aurafit-web.blackstone-033a1f17.eastus2.azurecontainerapps.io";

export const metadata: Metadata = {
  title: { absolute: "Aurafit — AI Fashion Styling" },
  description:
    "AI styling that builds finished looks from your wardrobe and the open web — try-on framing, editorial shopping links, no feed noise.",
  alternates: { canonical: "/" },
};

function jsonLd() {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Aurafit",
    url: appUrl,
    logo: `${appUrl}/og.png`,
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Aurafit",
    url: appUrl,
  };
  return JSON.stringify([org, website]).replace(/</g, "\\u003c");
}

export default async function LandingPage() {
  // Signed-in users have already done the marketing tour — fast-forward
  // them to the workspace so the home tab IS the styling tool. Cold
  // visitors keep seeing the landing page below.
  if (clerkPk) {
    const { userId } = await auth();
    if (userId) redirect("/generate");
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd() }}
      />
      <LandingHeader />
      <main id="main-content" className="relative overflow-hidden pt-[60px]">
        <Hero />
        <OutfitShowcase />
        <WardrobeDemo />
        <GenerationPreview />
        <SocialProof />

        <footer className="border-t border-aura-border bg-aura-stage px-6 py-20 md:px-12 md:py-24">
          <div className="mx-auto grid max-w-[1400px] gap-12 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-6">
              <p className="font-display text-2xl text-aura-foreground">Aurafit</p>
              <p className="mt-4 max-w-md text-sm leading-[1.75] text-aura-muted">
                AI styling with the discipline of a luxury house — quiet surfaces,
                clear outcomes, no feed energy.
              </p>
            </div>
            <div className="flex flex-col justify-end gap-4 md:col-span-6 md:items-end">
              <Link
                href="/sign-up?redirect_url=/generate"
                className="text-sm font-medium text-aura-champagne transition hover:text-aura-foreground"
              >
                Try the styling tool
              </Link>
              <div className="flex flex-wrap justify-end gap-4 text-xs text-aura-dim">
                <Link href="/pricing" className="hover:text-aura-champagne">
                  Pricing
                </Link>
                <Link href="/explore" className="hover:text-aura-champagne">
                  Explore
                </Link>
                <Link href="/legal/terms" className="hover:text-aura-champagne">
                  Terms
                </Link>
                <Link href="/legal/privacy" className="hover:text-aura-champagne">
                  Privacy
                </Link>
                <Link href="/legal/refund" className="hover:text-aura-champagne">
                  Refunds
                </Link>
                <Link href="/legal/affiliate" className="hover:text-aura-champagne">
                  Affiliates
                </Link>
                <CookieSettingsButton />
              </div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-aura-muted">
                © {new Date().getFullYear()} Aurafit
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
