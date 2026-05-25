"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type GridPatternProps = {
  className?: string;
  stroke?: string;
};

export function GridPattern({
  className,
  stroke = "rgba(255,255,255,0.07)",
}: GridPatternProps) {
  const id = useId().replace(/:/g, "");

  return (
    <svg
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full mask-gradient-b",
        className
      )}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern
          id={`grid-${id}`}
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 32 0 L 0 0 0 32"
            fill="none"
            stroke={stroke}
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#grid-${id})`} />
    </svg>
  );
}
