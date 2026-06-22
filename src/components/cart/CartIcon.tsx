"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCartStore } from "@/store/useCartStore";
import { cn } from "@/lib/utils";

function BagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M6 7h12l-1 13H7L6 7z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function CartIcon({
  className,
  showLabel = false,
  onClick,
}: {
  className?: string;
  showLabel?: boolean;
  onClick?: () => void;
}) {
  const count = useCartStore((s) => s.count);
  const fetchCart = useCartStore((s) => s.fetchCart);

  useEffect(() => {
    void fetchCart();
  }, [fetchCart]);

  const inner = (
    <>
      <span className="relative inline-flex">
        <BagIcon className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-aura-champagne px-1 text-[9px] font-semibold text-aura-void">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      {showLabel && <span>Cart</span>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`Cart${count ? `, ${count} items` : ""}`}
        className={cn(
          "flex items-center gap-3 rounded-sm border border-transparent px-3 py-2.5 font-medium transition-colors text-aura-dim hover:border-aura-border/60 hover:bg-aura-raised/40 hover:text-aura-foreground",
          className
        )}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      href="/cart"
      aria-label={`Cart${count ? `, ${count} items` : ""}`}
      className={cn(
        "flex items-center gap-3 rounded-sm border border-transparent px-3 py-2.5 font-medium transition-colors text-aura-dim hover:border-aura-border/60 hover:bg-aura-raised/40 hover:text-aura-foreground",
        className
      )}
    >
      {inner}
    </Link>
  );
}

export { BagIcon };
