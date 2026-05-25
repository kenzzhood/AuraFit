"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type BorderGlowProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  duration?: number;
};

/**
 * Rotating conic-gradient border — premium card chrome (Aceternity-style).
 */
export function BorderGlow({
  children,
  className,
  innerClassName,
  duration = 10,
}: BorderGlowProps) {
  return (
    <div className={cn("relative rounded-2xl p-px", className)}>
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-70"
        style={{
          background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 70deg, rgba(201,169,98,0.55) 100deg, rgba(232,196,160,0.45) 130deg, transparent 200deg, transparent 360deg)`,
          animation: `spin ${duration}s linear infinite`,
        }}
        aria-hidden
      />
      <div
        className={cn(
          "relative rounded-2xl border border-aura-border/80 bg-aura-raised/95 shadow-inner-highlight backdrop-blur-xl",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
