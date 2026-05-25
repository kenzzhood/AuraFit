import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { LandingHeader } from "@/components/layout/LandingHeader";
import { Hero } from "@/components/landing/Hero";
import { OutfitShowcase } from "@/components/landing/OutfitShowcase";
import { WardrobeDemo } from "@/components/landing/WardrobeDemo";
import { GenerationPreview } from "@/components/landing/GenerationPreview";
import { SocialProof } from "@/components/landing/SocialProof";

const clerkPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

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
      <LandingHeader />
      <main className="relative overflow-hidden pt-[60px]">
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
