"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SpotlightProps = {
  children: ReactNode;
  className?: string;
  strength?: number;
};

export function Spotlight({ children, className, strength = 1 }: SpotlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 40 });

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setPos({ x, y });
  }

  function onLeave() {
    setPos({ x: 50, y: 35 });
  }

  const spotlightStyle: CSSProperties = {
    background: `radial-gradient(520px circle at ${pos.x}% ${pos.y}%, rgba(212,184,150,${0.07 * strength}), rgba(184,149,107,0.03) 28%, transparent 55%)`,
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={spotlightStyle}
        aria-hidden
      />
      {children}
    </div>
  );
}
