"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { motion, AnimatePresence } from "framer-motion";
import type { CheckoutResponse } from "@/types/cart";
import { useCartStore } from "@/store/useCartStore";

function formatMoney(amount: number, currency: string) {
  const sym = currency === "INR" || !currency ? "₹" : "$";
  return `${sym}${amount.toLocaleString("en-IN")}`;
}

async function openRetailerLinks(
  items: CheckoutResponse["groups"][number]["items"],
  retailer: string
) {
  if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.capture("retailer_checkout_clicked", {
      retailer,
      item_count: items.length,
    });
  }

  for (const item of items) {
    try {
      const res = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: item.productUrl,
          source: "cart_checkout",
          outfitId: item.outfitId ?? undefined,
          productCacheId: item.productCacheId ?? undefined,
        }),
      });
      const data = (await res.json()) as { redirectUrl?: string };
      const url = res.ok && data.redirectUrl ? data.redirectUrl : item.effectiveUrl;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      window.open(item.effectiveUrl, "_blank", "noopener,noreferrer");
    }
  }
}

export function CheckoutDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const checkout = useCartStore((s) => s.checkout);
  const fetchCheckout = useCartStore((s) => s.fetchCheckout);
  const isLoading = useCartStore((s) => s.isLoading);

  useEffect(() => {
    if (open) void fetchCheckout();
  }, [open, fetchCheckout]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close checkout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl border border-aura-border bg-aura-stage p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-aura-foreground">
                  Checkout
                </h2>
                <p className="mt-1 text-sm text-aura-muted">
                  Opens each retailer in a new tab — no payment on Aurafit.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-aura-muted hover:text-aura-foreground"
              >
                Close
              </button>
            </div>

            {isLoading && (
              <p className="py-8 text-center text-sm text-aura-muted">
                Preparing checkout…
              </p>
            )}

            {!isLoading && checkout && checkout.groups.length === 0 && (
              <p className="py-8 text-center text-sm text-aura-muted">
                Your cart is empty.
              </p>
            )}

            {!isLoading && checkout && checkout.groups.length > 0 && (
              <div className="space-y-4">
                {checkout.groups.map((group) => (
                  <div
                    key={group.retailer}
                    className="rounded-2xl border border-aura-border bg-aura-ink/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-aura-foreground">
                          {group.retailer}
                        </p>
                        <p className="text-xs text-aura-muted">
                          {group.itemCount} item
                          {group.itemCount === 1 ? "" : "s"} ·{" "}
                          {formatMoney(group.subtotal, group.currency)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void openRetailerLinks(group.items, group.retailer)
                        }
                        className="rounded-xl bg-aura-champagne px-4 py-2 text-xs font-medium text-aura-void"
                      >
                        Open all
                      </button>
                    </div>
                    <ul className="mt-3 space-y-1">
                      {group.items.map((item) => (
                        <li
                          key={item.id}
                          className="truncate text-xs text-aura-dim"
                        >
                          {item.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                <div className="flex items-center justify-between border-t border-aura-border pt-4 text-sm">
                  <span className="text-aura-muted">Estimated total</span>
                  <span className="font-semibold text-aura-champagne">
                    {formatMoney(checkout.subtotal, checkout.currency)}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
