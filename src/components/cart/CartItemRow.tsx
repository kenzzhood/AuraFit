"use client";

import type { CartItemPublic } from "@/types/cart";
import { cn } from "@/lib/utils";

function formatPrice(price?: number | null, currency?: string) {
  if (price == null) return null;
  const sym =
    currency === "INR" || !currency ? "₹" : currency === "USD" ? "$" : "£";
  return `${sym}${price.toLocaleString("en-IN")}`;
}

export function CartItemRow({
  item,
  onRemove,
  onQuantityChange,
  compact = false,
}: {
  item: CartItemPublic;
  onRemove?: (id: string) => void;
  onQuantityChange?: (id: string, quantity: number) => void;
  compact?: boolean;
}) {
  const priceLabel = formatPrice(item.price, item.currency);

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-aura-border bg-aura-ink/50",
        compact ? "p-2.5" : "p-3"
      )}
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-aura-highlight/10">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-aura-muted">
            No image
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-aura-foreground">
          {item.title}
        </p>
        {item.retailer && (
          <p className="text-[10px] uppercase tracking-widest text-aura-muted">
            {item.retailer}
          </p>
        )}
        {priceLabel && (
          <p className="mt-0.5 text-xs text-aura-champagne">{priceLabel}</p>
        )}
        {!compact && onQuantityChange && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() =>
                onQuantityChange(
                  item.id,
                  Math.max(1, item.quantity - 1)
                )
              }
              className="flex h-6 w-6 items-center justify-center rounded border border-aura-border text-xs text-aura-foreground hover:bg-aura-highlight/20"
            >
              −
            </button>
            <span className="min-w-[1.5rem] text-center text-xs text-aura-foreground">
              {item.quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => onQuantityChange(item.id, item.quantity + 1)}
              className="flex h-6 w-6 items-center justify-center rounded border border-aura-border text-xs text-aura-foreground hover:bg-aura-highlight/20"
            >
              +
            </button>
          </div>
        )}
      </div>
      {onRemove && (
        <button
          type="button"
          aria-label="Remove from cart"
          onClick={() => onRemove(item.id)}
          className="self-start text-xs text-aura-muted hover:text-aura-foreground"
        >
          Remove
        </button>
      )}
    </div>
  );
}
