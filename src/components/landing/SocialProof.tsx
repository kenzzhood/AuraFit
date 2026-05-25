"use client";

import { motion } from "framer-motion";
import { GsapReveal } from "@/components/ui/gsap-reveal";

export function SocialProof() {
  return (
    <section className="relative py-20 md:py-28">
      <GsapReveal className="mx-auto max-w-3xl px-6 md:px-12">
        <div className="border-y border-aura-border py-16 md:py-20">
          <motion.blockquote
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-xl font-normal leading-snug text-aura-foreground md:text-2xl lg:text-[1.65rem]"
          >
            It reads like a fitting room: decisive, calm — never a chat bar
            dropped on top of a mall crawl.
          </motion.blockquote>
          <p className="mt-10 text-[10px] font-medium uppercase tracking-[0.35em] text-aura-muted">
            Private atelier · early access
          </p>
        </div>
      </GsapReveal>
    </section>
  );
}
