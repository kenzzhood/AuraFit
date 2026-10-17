"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics/track";
import { useCartStore } from "@/store/useCartStore";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { CheckoutDrawer } from "@/components/cart/CheckoutDrawer";
import { cn } from "@/lib/utils";

function formatMoney(amount: number, currency: string) {
  const sym = currency === "INR" || !currency ? "₹" : "$";
  return `${sym}${amount.toLocaleString("en-IN")}`;
}

type ViewMode = "outfit" | "retailer";

export default function CartPage() {
  const items = useCartStore((s) => s.items);
  const count = useCartStore((s) => s.count);
  const subtotal = useCartStore((s) => s.subtotal);
  const currency = useCartStore((s) => s.currency);
  const byOutfit = useCartStore((s) => s.byOutfit);
  const fetchCart = useCartStore((s) => s.fetchCart);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const [view, setView] = useState<ViewMode>("outfit");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    if (count > 0) {
      track("cart_viewed", { item_count: count, subtotal });
    }
  }, [count, subtotal]);

  const byRetailer = items.reduce<
    Record<string, typeof items>
  >((acc, item) => {
    const key = item.retailer ?? "Other";
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.32em] text-aura-muted">
            Atelier
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-aura-foreground">
            Your cart
          </h1>
          <p className="mt-2 text-sm text-aura-muted">
            {count} item{count === 1 ? "" : "s"} curated from your looks
          </p>
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={() => void clearCart()}
            className="text-xs text-aura-muted underline underline-offset-4 hover:text-aura-foreground"
          >
            Clear cart
          </button>
        )}
      </div>

      <div className="mb-6 flex gap-2">
        {(["outfit", "retailer"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setView(mode)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-medium capitalize transition-colors",
              view === mode
                ? "border-aura-champagne/50 bg-aura-champagne/10 text-aura-champagne"
                : "border-aura-border text-aura-muted hover:text-aura-foreground"
            )}
          >
            By {mode}
          </button>
        ))}
      </div>

      {count === 0 ? (
        <div className="rounded-2xl border border-dashed border-aura-border bg-aura-ink/30 px-6 py-16 text-center">
          <p className="text-sm text-aura-muted">
            Nothing here yet — add pieces from your generated looks.
          </p>
        </div>
      ) : view === "outfit" ? (
        <div className="space-y-6">
          {byOutfit.map((group) => (
            <section key={group.outfitId ?? group.outfitLabel ?? "ungrouped"}>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-aura-muted">
                {group.outfitLabel ?? "Individual items"}
              </h2>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onRemove={removeItem}
                    onQuantityChange={updateQuantity}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byRetailer).map(([retailer, groupItems]) => (
            <section key={retailer}>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-aura-muted">
                {retailer}
              </h2>
              <div className="space-y-2">
                {groupItems.map((item) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    onRemove={removeItem}
                    onQuantityChange={updateQuantity}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {count > 0 && (
        <div className="sticky bottom-24 mt-10 rounded-2xl border border-aura-border bg-aura-stage/95 p-5 backdrop-blur md:bottom-8">
          <div className="flex items-center justify-between text-sm">
            <span className="text-aura-muted">Estimated total</span>
            <span className="text-lg font-semibold text-aura-champagne">
              {formatMoney(subtotal, currency)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            className="mt-4 w-full rounded-xl bg-aura-champagne py-3 text-sm font-medium text-aura-void"
          >
            Checkout
          </button>
        </div>
      )}

      <CheckoutDrawer
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
      />
    </div>
  );
}
