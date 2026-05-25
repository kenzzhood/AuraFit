"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function LandingHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 right-0 top-0 z-50 border-b border-aura-border/60 bg-aura-void/85 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3.5 md:px-12">
        <Link
          href="/"
          className="font-display text-base font-semibold tracking-tight text-aura-foreground"
        >
          Aurafit
        </Link>
        <nav className="flex items-center gap-6 text-[13px] font-medium tracking-wide text-aura-dim md:gap-9">
          <Link
            href="/explore"
            className="transition-colors hover:text-aura-champagne"
          >
            Explore
          </Link>
          <Link
            href="#editorial"
            className="hidden transition-colors hover:text-aura-champagne sm:inline"
          >
            Boards
          </Link>
          <Link
            href="#wardrobe"
            className="transition-colors hover:text-aura-champagne"
          >
            Wardrobe
          </Link>
          <Link
            href="#pipeline"
            className="hidden transition-colors hover:text-aura-champagne md:inline"
          >
            Flow
          </Link>
          <Link
            href="/sign-in"
            className="rounded-sm border border-aura-borderBright px-4 py-2 text-aura-foreground transition-colors hover:border-aura-champagne/35 hover:bg-aura-raised/50"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </motion.header>
  );
}
