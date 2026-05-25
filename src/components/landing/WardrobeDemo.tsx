"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { GsapReveal } from "@/components/ui/gsap-reveal";

const railImg =
  "https://images.unsplash.com/photo-1558171813-4c088753af8f?q=85&w=1400&auto=format&fit=crop";

const steps = [
  { n: "01", label: "Segment", detail: "Garment-aware understanding" },
  { n: "02", label: "Embed", detail: "Vector wardrobe memory" },
  { n: "03", label: "Compose", detail: "Ranked looks, numbered grid" },
];

export function WardrobeDemo() {
  return (
    <section id="wardrobe" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <div className="grid items-stretch gap-12 lg:grid-cols-12 lg:gap-16">
          <GsapReveal className="lg:col-span-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-aura-sage">
              Wardrobe
            </p>
            <h2 className="mt-6 font-display text-3xl font-medium leading-tight tracking-tight text-aura-foreground md:text-4xl">
              The rail is the interface.
            </h2>
            <p className="mt-6 max-w-md text-sm leading-[1.75] text-aura-dim">
              Upload pieces once. Aurafit reads cut, color, and proportion — then
              composes from your closet before it suggests anything new from
              retail.
            </p>
            <ol className="mt-14 space-y-0 divide-y divide-aura-border border-y border-aura-border">
              {steps.map((s) => (
                <li
                  key={s.n}
                  className="grid grid-cols-[3rem_1fr] gap-6 py-5 md:grid-cols-[3.5rem_1fr]"
                >
                  <span className="font-mono text-[10px] tabular-nums text-aura-gold">
                    {s.n}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-aura-foreground">
                      {s.label}
                    </p>
                    <p className="mt-1 text-xs text-aura-muted">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </GsapReveal>

          <GsapReveal className="lg:col-span-7" y={32}>
            <motion.div
              className="relative aspect-[4/5] w-full overflow-hidden rounded-sm lg:aspect-[5/6]"
              whileHover={{ scale: 1.005 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <Image
                src={railImg}
                alt="Curated garments on a rail in low light"
                fill
                className="object-cover object-[center_30%]"
                sizes="(max-width: 1024px) 100vw, 58vw"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-aura-void/70 via-transparent to-transparent" />
              <p className="absolute bottom-8 left-8 max-w-xs text-[11px] leading-relaxed text-aura-dim">
                Drag-and-drop stays quiet — metadata never steals focus from the
                garment.
              </p>
            </motion.div>
          </GsapReveal>
        </div>
      </div>
    </section>
  );
}
