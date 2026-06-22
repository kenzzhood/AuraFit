"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import posthog from "posthog-js";
import { useCartStore } from "@/store/useCartStore";
import { CartItemRow } from "./CartItemRow";

function formatSubtotal(amount: number, currency: string) {
  const sym = currency === "INR" || !currency ? "₹" : "$";
  return `${sym}${amount.toLocaleString("en-IN")}`;
}

export function MiniCart({
  open,
  onClose,
  onCheckout,
}: {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}) {
  const items = useCartStore((s) => s.items);
  const count = useCartStore((s) => s.count);
  const subtotal = useCartStore((s) => s.subtotal);
  const currency = useCartStore((s) => s.currency);
  const removeItem = useCartStore((s) => s.removeItem);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  const preview = items.slice(0, 3);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-aura-border bg-aura-stage shadow-2xl"
        >
          <div className="border-b border-aura-border px-4 py-3">
            <p className="font-display text-sm font-semibold text-aura-foreground">
              Your cart
            </p>
            <p className="text-[11px] text-aura-muted">
              {count} item{count === 1 ? "" : "s"}
            </p>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto p-3">
            {preview.length === 0 ? (
              <p className="py-6 text-center text-sm text-aura-muted">
                Your cart is empty
              </p>
            ) : (
              preview.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  compact
                  onRemove={removeItem}
                />
              ))
            )}
            {items.length > 3 && (
              <p className="text-center text-[11px] text-aura-muted">
                +{items.length - 3} more
              </p>
            )}
          </div>

          {count > 0 && (
            <div className="border-t border-aura-border p-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-aura-muted">Subtotal</span>
                <span className="font-medium text-aura-champagne">
                  {formatSubtotal(subtotal, currency)}
                </span>
              </div>
              <div className="flex gap-2">
                <Link
                  href="/cart"
                  onClick={() => {
                    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
                      posthog.capture("cart_viewed", {
                        item_count: count,
                        subtotal,
                        source: "mini_cart",
                      });
                    }
                    onClose();
                  }}
                  className="flex-1 rounded-xl border border-aura-border py-2 text-center text-xs font-medium text-aura-foreground hover:bg-aura-highlight/10"
                >
                  View cart
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    onCheckout();
                    onClose();
                  }}
                  className="flex-1 rounded-xl bg-aura-champagne py-2 text-xs font-medium text-aura-void"
                >
                  Checkout
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
