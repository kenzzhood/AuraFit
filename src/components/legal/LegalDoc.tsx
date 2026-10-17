import type { ReactNode } from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/layout/LandingHeader";

export function LegalDoc({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <LandingHeader />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-[100px] md:px-12">
        <p className="font-display text-sm text-aura-champagne">Aurafit</p>
        <h1 className="mt-3 font-display text-3xl text-aura-foreground">{title}</h1>
        <p className="mt-2 text-xs text-aura-dim">Last updated: 18 July 2026</p>
        <div className="prose-legal mt-10 space-y-4 text-sm leading-relaxed text-aura-muted">
          {children}
        </div>
        <nav className="mt-16 flex flex-wrap gap-4 text-xs text-aura-dim">
          <Link href="/" className="hover:text-aura-champagne">
            Home
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
          <Link href="/pricing" className="hover:text-aura-champagne">
            Pricing
          </Link>
        </nav>
      </main>
    </>
  );
}
