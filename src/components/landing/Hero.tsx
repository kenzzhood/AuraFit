"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Spotlight } from "@/components/ui/spotlight";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=85&w=2000&auto=format&fit=crop";

export function Hero() {
  return (
    <Spotlight className="relative min-h-[100dvh]" strength={0.75}>
      <div className="pointer-events-none absolute inset-0 bg-aura-stage" />
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[42%] bg-gradient-to-r from-aura-stage to-transparent md:block" />

      <div className="relative z-10 mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 md:grid-cols-12 md:gap-0">
        <div className="flex flex-col justify-end px-6 pb-16 pt-28 md:col-span-5 md:justify-center md:px-12 md:pb-20 md:pt-32 lg:col-span-5">
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="text-[10px] font-medium uppercase tracking-[0.4em] text-aura-champagne"
          >
            Atelier
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 font-display text-[2.5rem] font-medium leading-[1.08] tracking-tight text-aura-foreground md:text-5xl lg:text-[3.35rem]"
          >
            Light on
            <span className="block text-aura-champagne">the decision.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="mt-8 max-w-[28rem] text-sm leading-[1.7] text-aura-dim md:text-[0.95rem]"
          >
            Four to six finished looks from your wardrobe and the open web. Try-on
            framing that respects proportion. Purchase links that read as
            editorial, not inventory.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12 flex flex-wrap items-center gap-4"
          >
            <Link
              href="/sign-up?redirect_url=/generate"
              className="group relative inline-flex overflow-hidden rounded-sm border border-aura-champagne/35 bg-aura-champagne px-8 py-3.5 text-sm font-semibold text-aura-void transition-colors hover:bg-[#c9a882]"
            >
              <span className="relative z-10">Try the styling tool</span>
            </Link>
            <Link
              href="/sign-in?redirect_url=/generate"
              className="rounded-sm border border-aura-border px-8 py-3.5 text-sm font-medium text-aura-foreground transition-colors hover:border-aura-borderBright hover:bg-aura-raised/60"
            >
              Sign in
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-14 max-w-xs border-l border-aura-champagne/25 pl-4 text-[11px] leading-relaxed text-aura-muted"
          >
            Photography: campaign-scale crops. Interface stays in the shadow so
            the garment reads first.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="relative min-h-[52dvh] md:col-span-7 md:min-h-[100dvh]"
        >
          <div className="absolute inset-0 bg-aura-ink md:left-[8%]">
            <Image
              src={HERO_IMAGE}
              alt="Editorial fashion still — full-length silhouette on a dark set"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 58vw"
              className="object-cover object-[center_20%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-aura-void via-transparent to-aura-void/30 md:bg-gradient-to-l md:from-aura-stage md:via-transparent md:to-transparent" />
          </div>
          <div className="pointer-events-none absolute bottom-10 left-6 right-6 flex justify-between border-t border-aura-border/40 pt-4 text-[10px] uppercase tracking-[0.28em] text-aura-muted md:left-[14%] md:right-10">
            <span>Look 03</span>
            <span className="text-aura-champagne/90">Structured line</span>
          </div>
        </motion.div>
      </div>
    </Spotlight>
  );
}
