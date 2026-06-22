"use client";

import posthog from "posthog-js";
import { useState } from "react";
import { useCartStore } from "@/store/useCartStore";
import type { CartItemInput } from "@/types/cart";

export type LookProduct = {
  title?: string;
  productUrl?: string;
  source?: string;
  productCacheId?: string;
  verified?: boolean;
  canonicalUrl?: string;
  availability?: "in_stock" | "out_of_stock" | "unknown";
  matchCategory?: string;
  price?: number;
  currency?: string;
  imageUrl?: string;
  storeName?: string;
  kind?: "online" | "wardrobe";
};

function isShoppable(p: LookProduct): boolean {
  if (p.kind === "wardrobe") return false;
  if (!p.productUrl) return false;
  if (p.source === "demo") return false;
  if (/example\.com/i.test(p.productUrl)) return false;
  if (p.verified !== true) return false;
  if (p.availability === "out_of_stock") return false;
  return true;
}

export function lookProductToCartInput(
  p: LookProduct,
  opts?: { outfitId?: string | null; outfitLabel?: string }
): CartItemInput | null {
  const url = p.canonicalUrl ?? p.productUrl;
  if (!url || !isShoppable(p)) return null;
  return {
    productCacheId: p.productCacheId,
    outfitId: opts?.outfitId ?? undefined,
    outfitLabel: opts?.outfitLabel,
    title: p.title ?? "Product",
    imageUrl: p.imageUrl,
    productUrl: url,
    retailer: p.storeName ?? p.source,
    price: p.price,
    currency: p.currency,
    category: p.matchCategory,
  };
}

export function OutfitCard({
  index,
  imageUrl,
  products,
  outfitId,
  outfitLabel,
  onSave,
}: {
  index: number;
  imageUrl?: string | null;
  products?: LookProduct[];
  outfitId?: string | null;
  outfitLabel?: string;
  onSave?: () => void;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const addOutfit = useCartStore((s) => s.addOutfit);
  const [adding, setAdding] = useState(false);

  const label = outfitLabel ?? `Look ${index + 1}`;

  const openProduct = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    p: LookProduct
  ) => {
    e.preventDefault();
    const target = p.canonicalUrl ?? p.productUrl;
    if (!target) return;
    try {
      const r = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: target,
          source: "outfit_grid",
          outfitId: outfitId ?? undefined,
          productCacheId: p.productCacheId,
        }),
      });
      const data = (await r.json()) as { redirectUrl?: string };
      if (r.ok && data.redirectUrl) {
        if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
          posthog.capture("affiliate_click", {
            source: "outfit_grid",
            has_outfit: !!outfitId,
          });
        }
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
        return;
      }
    } catch {
      /* fall through */
    }
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const handleAddOutfit = async () => {
    const shoppable = (products ?? []).filter(isShoppable);
    const inputs = shoppable
      .map((p) => lookProductToCartInput(p, { outfitId, outfitLabel: label }))
      .filter((x): x is CartItemInput => !!x);
    if (inputs.length === 0) return;
    setAdding(true);
    try {
      await addOutfit(outfitId ?? undefined, label, inputs);
    } finally {
      setAdding(false);
    }
  };

  const handleAddItem = async (p: LookProduct) => {
    const input = lookProductToCartInput(p, { outfitId, outfitLabel: label });
    if (!input) return;
    await addItem(input);
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-aura-border bg-aura-ink/40">
      <div className="relative aspect-[3/4] bg-aura-highlight/10">
        <div className="absolute left-2 top-2 rounded-full bg-aura-void/80 px-2 py-0.5 text-[10px] font-medium text-aura-champagne">
          Look {index + 1}
        </div>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-aura-muted">
            Render pending
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="max-h-28 space-y-1 overflow-y-auto">
          {(() => {
            const all = products ?? [];
            const shoppable = all.filter(isShoppable).slice(0, 3);
            if (shoppable.length === 0) {
              return (
                <p className="text-[11px] italic text-aura-muted">
                  {all.length ? "Verifying products…" : "Finding products…"}
                </p>
              );
            }
            return shoppable.map((p, i) => (
              <div key={i} className="flex items-center gap-1">
                <a
                  href={p.canonicalUrl ?? p.productUrl ?? "#"}
                  onClick={(e) => openProduct(e, p)}
                  className="min-w-0 flex-1 truncate text-[11px] text-aura-champagne underline underline-offset-2"
                >
                  {p.matchCategory ? (
                    <span className="mr-1 text-aura-muted">
                      [{p.matchCategory}]
                    </span>
                  ) : null}
                  {p.title ?? "Product link"}
                </a>
                <button
                  type="button"
                  onClick={() => void handleAddItem(p)}
                  className="shrink-0 rounded border border-aura-border px-1.5 py-0.5 text-[9px] text-aura-muted hover:bg-aura-highlight/20 hover:text-aura-champagne"
                >
                  + Cart
                </button>
              </div>
            ));
          })()}
        </div>
        <div className="mt-auto flex flex-col gap-1.5">
          {(products ?? []).some(isShoppable) && (
            <button
              type="button"
              disabled={adding}
              onClick={() => void handleAddOutfit()}
              className="rounded-lg border border-aura-champagne/40 py-1.5 text-xs text-aura-champagne hover:bg-aura-champagne/10 disabled:opacity-50"
            >
              {adding ? "Adding…" : "Add outfit"}
            </button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="rounded-lg border border-aura-border py-1.5 text-xs text-aura-foreground hover:bg-aura-highlight"
            >
              Save outfit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
