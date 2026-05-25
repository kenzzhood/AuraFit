"use client";

import { motion } from "framer-motion";
import { GsapReveal } from "@/components/ui/gsap-reveal";

const pipeline = [
  { step: "01", title: "Ingest", detail: "Vision and garment structure" },
  { step: "02", title: "Search", detail: "Wardrobe memory and open web" },
  { step: "03", title: "Render", detail: "Try-on grid, numbered looks" },
  { step: "04", title: "Refine", detail: "Stylist thread and links" },
];

export function GenerationPreview() {
  return (
    <section
      id="pipeline"
      className="relative border-y border-aura-border bg-aura-surface/40 py-24 md:py-32"
    >
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <GsapReveal className="max-w-2xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-aura-rose">
            Pipeline
          </p>
          <h2 className="mt-6 font-display text-3xl font-medium leading-tight text-aura-foreground md:text-4xl">
            Status you read in passing.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-aura-dim">
            One rail, four beats — no equal tiles pretending each job is the
            same weight.
          </p>
        </GsapReveal>

        <GsapReveal className="mt-16" y={20}>
          <div className="flex flex-col gap-0 md:flex-row md:items-stretch">
            {pipeline.map((item, i) => (
              <div
                key={item.step}
                className={`group relative flex-1 border-t border-aura-border py-8 md:border-t-0 md:border-l md:border-aura-border md:px-8 md:py-10 ${i === 0 ? "md:border-l-0 md:pl-0" : ""}`}
              >
                <motion.div
                  initial={{ opacity: 0.85 }}
                  whileHover={{ opacity: 1 }}
                  className="transition-transform duration-300 md:group-hover:-translate-y-0.5"
                >
                  <p className="font-mono text-[10px] tabular-nums text-aura-gold">
                    {item.step}
                  </p>
                  <p className="mt-4 font-display text-xl text-aura-foreground">
                    {item.title}
                  </p>
                  <p className="mt-2 max-w-[14rem] text-xs leading-relaxed text-aura-muted">
                    {item.detail}
                  </p>
                </motion.div>
                {i < pipeline.length - 1 && (
                  <div className="my-6 h-px w-full bg-aura-border md:hidden" />
                )}
              </div>
            ))}
          </div>
        </GsapReveal>
      </div>
    </section>
  );
}
