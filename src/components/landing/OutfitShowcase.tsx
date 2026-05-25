"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { GsapReveal } from "@/components/ui/gsap-reveal";

const primary =
  "https://images.unsplash.com/photo-1529134062919-6785442d7a8d?q=85&w=1600&auto=format&fit=crop";
const secondary =
  "https://images.unsplash.com/photo-1515377905703-c4788e51af15?q=85&w=1200&auto=format&fit=crop";
const tertiary =
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=85&w=1200&auto=format&fit=crop";

const copy = [
  {
    title: "Soft tailoring",
    line: "Camel, ivory, single break at the hem",
  },
  {
    title: "Evening line",
    line: "One column of light, charcoal ground",
  },
];

export function OutfitShowcase() {
  return (
    <section
      id="editorial"
      className="relative border-t border-aura-border bg-aura-ink py-24 md:py-32"
    >
      <div className="relative z-10 mx-auto max-w-[1400px] px-6 md:px-12">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4 lg:flex lg:flex-col lg:justify-between">
            <GsapReveal>
              <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-aura-champagne">
                Editorial boards
              </p>
              <h2 className="mt-6 max-w-[14ch] font-display text-3xl font-medium leading-tight tracking-tight text-aura-foreground md:text-4xl lg:text-[2.65rem]">
                Each grid is paced like a shoot.
              </h2>
              <p className="mt-6 max-w-md text-sm leading-[1.75] text-aura-dim">
                Unequal frames, one dominant plate. The same discipline your
                stylist brings to rails — translated for the screen.
              </p>
            </GsapReveal>
            <GsapReveal className="mt-12 hidden lg:mt-0 lg:block">
              <ul className="space-y-8 border-l border-aura-border pl-6">
                {copy.map((item) => (
                  <li key={item.title}>
                    <p className="font-display text-lg text-aura-foreground">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-aura-muted">
                      {item.line}
                    </p>
                  </li>
                ))}
              </ul>
            </GsapReveal>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-6 lg:gap-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative aspect-[3/4] overflow-hidden rounded-sm sm:col-span-2 lg:col-span-4 lg:row-span-2 lg:aspect-auto lg:min-h-[min(72vh,640px)] shadow-edge-warm"
            >
              <Image
                src={primary}
                alt="Tailored coat and layered ensemble — editorial crop"
                fill
                className="object-cover object-[center_35%]"
                sizes="(max-width: 1024px) 100vw, 55vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-aura-void/50 via-transparent to-transparent" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="relative aspect-[4/5] overflow-hidden rounded-sm lg:col-span-2"
            >
              <Image
                src={secondary}
                alt="Detail of fabric and drape under controlled light"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 50vw, 22vw"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="relative aspect-[4/5] overflow-hidden rounded-sm lg:col-span-2"
            >
              <Image
                src={tertiary}
                alt="Full-length look on neutral set"
                fill
                className="object-cover object-[center_25%]"
                sizes="(max-width: 1024px) 50vw, 22vw"
              />
            </motion.div>
          </div>
        </div>

        <div className="mt-12 border-t border-aura-border pt-10 lg:hidden">
          <ul className="space-6">
            {copy.map((item) => (
              <li key={item.title}>
                <p className="font-display text-lg text-aura-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-aura-muted">{item.line}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
