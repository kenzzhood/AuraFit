"use client";

import { cn } from "@/lib/utils";

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <p className="mb-2 text-xs text-aura-muted" id={`${label}-label`}>
          {label}
        </p>
      )}
      <div
        role="listbox"
        aria-labelledby={label ? `${label}-label` : undefined}
        className="flex flex-wrap gap-2"
      >
        {options.map((opt) => {
          const active = opt === value;
          return (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onChange(opt)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aura-champagne/50",
                active
                  ? "border-aura-champagne bg-aura-champagne/15 text-aura-champagne"
                  : "border-aura-border text-aura-muted hover:border-aura-champagne/30 hover:text-aura-foreground"
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
