"use client";

import posthog from "posthog-js";

export type LookProduct = {
  title?: string;
  productUrl?: string;
  source?: string;
  productCacheId?: string;
  verified?: boolean;
  canonicalUrl?: string;
  availability?: "in_stock" | "out_of_stock" | "unknown";
  matchCategory?: string;
};

/**
 * Only render products that were validated against a real product detail
 * page (`verified === true`) and are in stock. The backend has its own filter
 * but this is a belt-and-braces guard so users never see a snippet,
 * placeholder, or out-of-stock listing rendered as a real product link.
 */
function isShoppable(p: LookProduct): boolean {
  if (!p.productUrl) return false;
  if (p.source === "demo") return false;
  if (/example\.com/i.test(p.productUrl)) return false;
  if (p.verified !== true) return false;
  if (p.availability === "out_of_stock") return false;
  return true;
}

export function OutfitCard({
  index,
  imageUrl,
  products,
  outfitId,
  onSave,
}: {
  index: number;
  imageUrl?: string | null;
  products?: LookProduct[];
  /** Server outfit id when generation finished (affiliate attribution). */
  outfitId?: string | null;
  onSave?: () => void;
}) {
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
              <a
                key={i}
                href={p.canonicalUrl ?? p.productUrl ?? "#"}
                onClick={(e) => openProduct(e, p)}
                className="block truncate text-[11px] text-aura-champagne underline underline-offset-2"
              >
                {p.matchCategory ? (
                  <span className="mr-1 text-aura-muted">
                    [{p.matchCategory}]
                  </span>
                ) : null}
                {p.title ?? "Product link"}
              </a>
            ));
          })()}
        </div>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            className="mt-auto rounded-lg border border-aura-border py-1.5 text-xs text-aura-foreground hover:bg-aura-highlight"
          >
            Save outfit
          </button>
        )}
      </div>
    </div>
  );
}
