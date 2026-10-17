import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aura-champagne/50 focus-visible:ring-offset-2 focus-visible:ring-offset-aura-void disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-aura-champagne text-aura-void hover:bg-aura-champagne/90",
        secondary:
          "border border-aura-border bg-aura-ink text-aura-foreground hover:border-aura-champagne/40",
        ghost:
          "text-aura-muted hover:bg-aura-highlight/20 hover:text-aura-foreground",
        champagne:
          "border border-aura-champagne/50 bg-aura-champagne/10 text-aura-champagne hover:bg-aura-champagne/20",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2.5",
        lg: "w-full py-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
