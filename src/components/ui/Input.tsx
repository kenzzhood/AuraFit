import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="text-xs text-aura-muted">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "mt-1 w-full rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm text-aura-foreground placeholder:text-aura-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aura-champagne/40",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
Input.displayName = "Input";
