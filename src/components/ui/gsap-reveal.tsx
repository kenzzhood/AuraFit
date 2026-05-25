"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type GsapRevealProps = {
  children: ReactNode;
  className?: string;
  y?: number;
  duration?: number;
};

/**
 * Scroll-triggered fade-up via GSAP ScrollTrigger (Aceternity / premium SaaS pattern).
 */
export function GsapReveal({
  children,
  className,
  y = 36,
  duration = 0.85,
}: GsapRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cleanup: (() => void) | undefined;

    const run = async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      gsap.registerPlugin(ScrollTrigger);

      const ctx = gsap.context(() => {
        gsap.fromTo(
          el,
          { opacity: 0, y },
          {
            opacity: 1,
            y: 0,
            duration,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          }
        );
      }, el);

      cleanup = () => ctx.revert();
    };

    void run();

    return () => {
      cleanup?.();
    };
  }, [y, duration]);

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
