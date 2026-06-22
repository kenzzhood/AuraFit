"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCartStore } from "@/store/useCartStore";

export function CartToast() {
  const message = useCartStore((s) => s.cartToast);
  const dismissCartToast = useCartStore((s) => s.dismissCartToast);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => dismissCartToast(), 4000);
    return () => clearTimeout(t);
  }, [message, dismissCartToast]);

  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 z-50 flex w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-aura-champagne/40 bg-aura-stage px-4 py-3 shadow-2xl md:bottom-8"
    >
      <p className="text-sm text-aura-foreground">{message}</p>
      <Link
        href="/cart"
        onClick={dismissCartToast}
        className="shrink-0 text-xs font-medium text-aura-champagne underline underline-offset-2"
      >
        View cart
      </Link>
    </div>
  );
}
