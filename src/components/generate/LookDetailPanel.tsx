"use client";

import { useState } from "react";
import posthog from "posthog-js";
import type { GenerationLookResult } from "@/types/generation";
import { PublishModal } from "@/components/social/PublishModal";
import { lookProductToCartInput } from "@/components/generate/OutfitCard";
import { useCartStore } from "@/store/useCartStore";

function formatPrice(price?: number, currency?: string) {
  if (price == null) return null;
  const sym =
    currency === "INR" || !currency ? "₹" : currency === "USD" ? "$" : "£";
  return `${sym}${price.toLocaleString("en-IN")}`;
}

/**
 * Only display products that were validated against a real product detail
 * page (`verified === true`). The backend already filters but this is a
 * belt-and-braces guard so demo/snippet rows never leak into the panel —
 * a product we can't trust never gets a link.
 *
 * Wardrobe items (`kind: "wardrobe"`) bypass the productUrl gating because
 * their "url" is a SAS-signed Azure blob link that we don't want users to
 * navigate to anyway — we just need to render a thumbnail + a pill.
 */
function isShoppable(p: {
  productUrl?: string;
  source?: string;
  verified?: boolean;
  availability?: string;
  kind?: "online" | "wardrobe";
}): boolean {
  if (p.kind === "wardrobe") return true;
  if (!p.productUrl) return false;
  if (p.source === "demo") return false;
  if (/example\.com/i.test(p.productUrl)) return false;
  if (p.verified !== true) return false;
  if (p.availability === "out_of_stock") return false;
  return true;
}

function isWardrobeProduct(p: { kind?: "online" | "wardrobe" }): boolean {
  return p.kind === "wardrobe";
}

const CATEGORY_LABELS: Record<string, string> = {
  outerwear: "Outerwear",
  dress: "Dress",
  top: "Top",
  bottom: "Bottom",
  shoes: "Shoes",
  accessory: "Accessory",
  garment: "Garment",
};

function prettyCategory(c?: string): string {
  if (!c) return "Garment";
  return CATEGORY_LABELS[c.toLowerCase()] ?? c.replace(/^./, (m) => m.toUpperCase());
}

/**
 * Returns true when the LLM-supplied description is too generic to
 * display (e.g. "TOP", "OTHER"). The breakdown card falls back to the
 * matched product's title or a category-derived label.
 */
function isUselessItemDescription(value: string | undefined | null): boolean {
  if (!value) return true;
  const s = value.trim().toLowerCase();
  if (s.length < 4) return true;
  if (/^(top|bottom|dress|outerwear|shoes?|accessory|garment|other|footwear|item)$/.test(s)) {
    return true;
  }
  if (!/\s/.test(s) && s.length < 8) return true;
  return false;
}

function prettifyItemDescription(
  raw: string | undefined,
  matchedTitle: string | undefined,
  category: string | undefined
): string {
  if (!isUselessItemDescription(raw)) return raw!.trim();
  if (!isUselessItemDescription(matchedTitle)) return matchedTitle!.trim();
  return `${prettyCategory(category)} from your wardrobe`;
}

function canonicalCategory(c?: string): string {
  const s = (c ?? "").toLowerCase().trim();
  if (!s) return "garment";
  if (/(dress|gown|jumpsuit|romper|saree|sari|kurta|lehenga)/.test(s)) return "dress";
  if (/(jacket|blazer|coat|outer|overcoat|trench)/.test(s)) return "outerwear";
  if (/(shirt|tee|t-?shirt|top|blouse|polo|knit|sweater|hoodie)/.test(s)) return "top";
  if (/(jean|trouser|pant|chino|short|bottom|skirt|cargo)/.test(s)) return "bottom";
  if (/(shoe|sneaker|loafer|boot|footwear|sandal|heel)/.test(s)) return "shoes";
  if (/(watch|belt|bag|clutch|purse|hat|cap|sunglass|accessor|scarf|jewel|earring|necklace|bracelet)/.test(s)) return "accessory";
  return s;
}

function prettySource(s?: string): string | null {
  if (!s) return null;
  if (s === "crawl") return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function LookDetailPanel({
  look,
  lookIndex,
  outfitId,
  onSave,
}: {
  look: GenerationLookResult | null;
  lookIndex: number | null;
  outfitId?: string | null;
  onSave?: () => void;
}) {
  const [publishOpen, setPublishOpen] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const addOutfit = useCartStore((s) => s.addOutfit);
  const [addingOutfit, setAddingOutfit] = useState(false);

  const outfitLabel =
    lookIndex != null && look
      ? `${look.label ?? `Look ${lookIndex + 1}`}`
      : undefined;

  if (lookIndex == null || !look) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-aura-border bg-aura-ink/30 p-8 text-center">
        <p className="text-sm text-aura-muted">
          Select a look (1–6) to see the full outfit breakdown and shop links.
        </p>
      </div>
    );
  }

  const openProduct = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    productUrl?: string,
    productCacheId?: string
  ) => {
    e.preventDefault();
    if (!productUrl) return;
    try {
      const r = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: productUrl,
          source: "look_detail",
          outfitId: outfitId ?? undefined,
          productCacheId,
        }),
      });
      const data = (await r.json()) as { redirectUrl?: string };
      if (r.ok && data.redirectUrl) {
        if (
          typeof window !== "undefined" &&
          process.env.NEXT_PUBLIC_POSTHOG_KEY
        ) {
          posthog.capture("affiliate_click", { source: "look_detail" });
        }
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
        return;
      }
    } catch {
      /* fall through */
    }
    window.open(productUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col overflow-visible rounded-2xl border border-aura-border bg-aura-ink/40 lg:max-h-[80vh] lg:overflow-hidden">
      <div className="border-b border-aura-border px-5 py-4">
        <p className="text-[10px] uppercase tracking-widest text-aura-muted">
          Look {lookIndex + 1}
        </p>
        <h3 className="font-display text-xl text-aura-foreground">
          {look.label}
        </h3>
        {look.tagline && (
          <p className="mt-1 text-sm text-aura-champagne">{look.tagline}</p>
        )}
      </div>

      <div className="flex-1 space-y-5 px-5 py-4 lg:overflow-y-auto">
        {look.description && (
          <p className="text-sm leading-relaxed text-aura-dim">
            {look.description}
          </p>
        )}
        {(look.bestFor || look.priceRange) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {look.bestFor && (
              <span className="rounded-full border border-aura-border px-2 py-1 text-aura-muted">
                Best for: {look.bestFor}
              </span>
            )}
            {look.priceRange && (
              <span className="rounded-full border border-aura-champagne/40 px-2 py-1 text-aura-champagne">
                {look.priceRange}
              </span>
            )}
          </div>
        )}

        {(() => {
          const allProducts = look.products ?? [];
          const shoppable = allProducts.filter(isShoppable);
          // Build a map: matchCategory -> first verified product. This drives
          // both the "Outfit breakdown" pairing and the "Shop this look" list.
          const byCategory = new Map<string, (typeof shoppable)[number]>();
          for (const p of shoppable) {
            const key = canonicalCategory(p.matchCategory ?? "garment");
            if (!byCategory.has(key)) byCategory.set(key, p);
          }

          const items = look.items ?? [];

          return (
            <>
              {items.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium uppercase tracking-widest text-aura-muted">
                    Outfit breakdown
                  </h4>
                  <ul className="mt-2 space-y-3">
                    {items.map((item, i) => {
                      const key = canonicalCategory(item.category);
                      const matched = byCategory.get(key);
                      const wardrobeThumb =
                        matched && isWardrobeProduct(matched)
                          ? matched.imageUrl
                          : undefined;
                      const description = prettifyItemDescription(
                        item.description,
                        matched?.title,
                        item.category
                      );
                      return (
                        <li
                          key={i}
                          className="flex gap-3 rounded-xl border border-aura-border bg-aura-highlight/10 px-3 py-2"
                        >
                          {wardrobeThumb && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={wardrobeThumb}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-aura-champagne/30"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] uppercase text-aura-muted">
                                {prettyCategory(item.category)}
                              </p>
                              {matched ? (
                                isWardrobeProduct(matched) ? (
                                  <span className="rounded-full bg-aura-champagne/15 px-2 py-[2px] text-[9px] uppercase tracking-widest text-aura-champagne">
                                    From wardrobe
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-emerald-500/15 px-2 py-[2px] text-[9px] uppercase tracking-widest text-emerald-300">
                                    Verified
                                  </span>
                                )
                              ) : (
                                <span className="rounded-full bg-aura-highlight/15 px-2 py-[2px] text-[9px] uppercase tracking-widest text-aura-muted">
                                  Verifying…
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-sm leading-snug text-aura-foreground">
                              {description}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-medium uppercase tracking-widest text-aura-muted">
                    Shop this look
                  </h4>
                  {shoppable.some(
                    (p) =>
                      p.kind !== "wardrobe" &&
                      p.verified === true &&
                      !!p.productUrl
                  ) && (
                    <button
                      type="button"
                      disabled={addingOutfit}
                      onClick={async () => {
                        const inputs = (look.products ?? [])
                          .map((p) =>
                            lookProductToCartInput(p, { outfitId, outfitLabel })
                          )
                          .filter((x): x is NonNullable<typeof x> => !!x);
                        if (inputs.length === 0) return;
                        setAddingOutfit(true);
                        try {
                          await addOutfit(outfitId ?? undefined, outfitLabel ?? "", inputs);
                        } finally {
                          setAddingOutfit(false);
                        }
                      }}
                      className="rounded-full border border-aura-champagne/50 bg-aura-champagne/10 px-3 py-1 text-[11px] font-medium text-aura-champagne transition-colors hover:bg-aura-champagne/20 disabled:opacity-50"
                    >
                      {addingOutfit ? "Adding…" : "+ Add look to cart"}
                    </button>
                  )}
                </div>
                {shoppable.length > 0 && shoppable.length < items.length && (
                  <p className="mt-2 text-xs leading-5 text-aura-muted">
                    We found {shoppable.length} verified link
                    {shoppable.length === 1 ? "" : "s"}. More links are still
                    being checked in the background.
                  </p>
                )}
                {shoppable.length === 0 ? (
                  <p className="mt-2 text-sm italic text-aura-muted">
                    {allProducts.length
                      ? "Verifying product links…"
                      : "Finding products that match this look…"}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {shoppable.map((p, i) => {
                      const store = p.storeName ?? prettySource(p.source);
                      const wardrobe = isWardrobeProduct(p);
                      return (
                        <li
                          key={i}
                          className="flex gap-3 rounded-xl border border-aura-border bg-aura-ink/60 p-3"
                        >
                          {p.imageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="h-14 w-14 shrink-0 rounded-lg object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] uppercase tracking-widest text-aura-muted">
                                {prettyCategory(p.matchCategory)}
                              </p>
                              {wardrobe ? (
                                <span className="rounded-full bg-aura-champagne/15 px-2 py-[2px] text-[9px] uppercase tracking-widest text-aura-champagne">
                                  From wardrobe
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-500/15 px-2 py-[2px] text-[9px] uppercase tracking-widest text-emerald-300">
                                  Verified
                                </span>
                              )}
                            </div>
                            <p className="truncate text-sm font-medium text-aura-foreground">
                              {isUselessItemDescription(p.title)
                                ? `${prettyCategory(p.matchCategory)} from your wardrobe`
                                : p.title}
                            </p>
                            {!wardrobe && store && (
                              <p className="text-[10px] text-aura-muted">
                                {store}
                              </p>
                            )}
                            {!wardrobe && formatPrice(p.price, p.currency) && (
                              <p className="mt-0.5 text-xs text-aura-champagne">
                                {formatPrice(p.price, p.currency)}
                              </p>
                            )}
                            {wardrobe ? (
                              <p className="mt-2 text-[11px] italic text-aura-muted">
                                A piece from your closet — already yours.
                              </p>
                            ) : (
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <a
                                  href={p.canonicalUrl ?? p.productUrl ?? "#"}
                                  onClick={(e) =>
                                    openProduct(
                                      e,
                                      p.canonicalUrl ?? p.productUrl,
                                      p.productCacheId
                                    )
                                  }
                                  className="rounded-full border border-aura-border px-3 py-1 text-xs font-medium text-aura-champagne transition-colors hover:bg-aura-highlight/20"
                                >
                                  Shop →
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const input = lookProductToCartInput(p, {
                                      outfitId,
                                      outfitLabel,
                                    });
                                    if (input) void addItem(input);
                                  }}
                                  className="rounded-full border border-aura-champagne/50 bg-aura-champagne/10 px-3 py-1 text-xs font-medium text-aura-champagne transition-colors hover:bg-aura-champagne/20"
                                >
                                  + Add to cart
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          );
        })()}
      </div>

      {(onSave || outfitId) && (
        <div className="border-t border-aura-border p-4">
          <div className="flex gap-2">
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                className="flex-1 rounded-xl bg-aura-champagne py-2.5 text-sm font-medium text-aura-void"
              >
                Save this look
              </button>
            )}
            {outfitId && (
              <button
                type="button"
                onClick={() => setPublishOpen(true)}
                className="flex-1 rounded-xl border border-aura-champagne py-2.5 text-sm font-medium text-aura-champagne"
              >
                Share to Atelier
              </button>
            )}
          </div>
          {!outfitId && onSave && (
            <p className="mt-2 text-[10px] text-aura-muted">
              Save this look first to share it on Explore.
            </p>
          )}
        </div>
      )}

      <PublishModal
        outfitId={outfitId ?? null}
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
      />
    </div>
  );
}
