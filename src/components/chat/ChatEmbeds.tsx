"use client";

import { useState } from "react";
import type { StylistProductCard } from "@/lib/ai/stylist-events";
import type { GenerationLookResult, LookProduct } from "@/types/generation";
import { displayProductImageSrc } from "@/lib/media/display-product-image";

async function openShop(
  productUrl: string,
  productCacheId?: string
) {
  try {
    const r = await fetch("/api/affiliate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUrl: productUrl,
        source: "chat",
        productCacheId,
      }),
    });
    const data = (await r.json()) as { redirectUrl?: string };
    if (r.ok && data.redirectUrl) {
      window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      return;
    }
  } catch {
    /* fall through */
  }
  window.open(productUrl, "_blank", "noopener,noreferrer");
}

function ShopThumb({ src }: { src: string }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-16 w-16 shrink-0 rounded object-cover"
      onError={() => setHidden(true)}
    />
  );
}

function ShopRow({
  title,
  productUrl,
  imageUrl,
  price,
  currency,
  source,
  matchCategory,
  productCacheId,
}: {
  title?: string;
  productUrl?: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  source?: string;
  matchCategory?: string;
  productCacheId?: string;
}) {
  if (!productUrl) return null;
  const priceLabel =
    price != null ? `${currency ?? "INR"} ${price.toLocaleString()}` : null;
  const thumb = displayProductImageSrc(imageUrl);
  return (
    <a
      href={productUrl}
      onClick={(e) => {
        e.preventDefault();
        void openShop(productUrl, productCacheId);
      }}
      className="flex items-center gap-2 rounded-lg border border-aura-border bg-aura-highlight/10 px-2 py-1.5 hover:border-aura-champagne/40"
    >
      {thumb ? <ShopThumb src={thumb} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-aura-foreground">
          {title ?? "Shop this"}
        </span>
        <span className="block truncate text-[10px] text-aura-muted">
          {[matchCategory, source, priceLabel].filter(Boolean).join(" · ")}
        </span>
      </span>
    </a>
  );
}

export function ChatProductsEmbed({
  products,
}: {
  products: StylistProductCard[];
}) {
  if (!products.length) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-widest text-aura-muted">
        Shoppable matches
      </p>
      {products.map((p) => (
        <ShopRow key={p.productUrl} {...p} />
      ))}
    </div>
  );
}

export function looksEmbedFailureMessage(
  jobStatus?: string,
  error?: string | null
): string | null {
  if (jobStatus !== "FAILED" && jobStatus !== "failed") return null;
  const trimmed = error?.trim();
  return trimmed ? trimmed : "Look render failed. Try again in chat.";
}

export function looksEmbedModel(params: {
  jobStatus?: string;
  error?: string | null;
  looks?: GenerationLookResult[];
}): { failMessage: string | null; looks: GenerationLookResult[] } {
  return {
    failMessage: looksEmbedFailureMessage(params.jobStatus, params.error),
    looks: params.looks ?? [],
  };
}

export type ChatJobPoll = {
  status: string;
  error?: string | null;
  result?: {
    boardImageUrl?: string | null;
    looks?: GenerationLookResult[];
  };
};

export function mergeChatJobPoll<
  T extends {
    jobStatus?: string;
    jobError?: string | null;
    boardImageUrl?: string;
    looks?: GenerationLookResult[];
  },
>(m: T, job: ChatJobPoll): T {
  return {
    ...m,
    jobStatus: job.status,
    jobError: job.error,
    boardImageUrl: job.result?.boardImageUrl ?? m.boardImageUrl,
    looks: job.result?.looks ?? m.looks,
  };
}

function LookShopList({ look }: { look: GenerationLookResult }) {
  const products = (look.products ?? []).filter(
    (p: LookProduct) => p.kind !== "wardrobe" && p.productUrl
  );
  if (!products.length) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {products.map((p, i) => (
        <ShopRow
          key={`${p.productUrl ?? i}`}
          title={p.title}
          productUrl={p.productUrl}
          imageUrl={p.imageUrl}
          price={p.price}
          currency={p.currency}
          source={p.source}
          matchCategory={p.matchCategory}
          productCacheId={p.productCacheId}
        />
      ))}
    </div>
  );
}

export function ChatLooksEmbed({
  jobStatus,
  boardImageUrl,
  looks,
  error,
}: {
  jobStatus?: string;
  boardImageUrl?: string;
  looks?: GenerationLookResult[];
  error?: string | null;
}) {
  const pending =
    jobStatus === "queued" || jobStatus === "processing" || jobStatus === "QUEUED" || jobStatus === "PROCESSING";
  const { failMessage, looks: displayLooks } = looksEmbedModel({
    jobStatus,
    error,
    looks,
  });
  return (
    <div className="space-y-3">
      {pending && (
        <p className="text-xs text-aura-muted">
          Rendering your looks… This uses a look credit.
        </p>
      )}
      {failMessage ? (
        <p className="text-xs text-red-400">{failMessage}</p>
      ) : null}
      {boardImageUrl ? (
        <div className="overflow-hidden rounded-xl border border-aura-champagne/30 bg-aura-ink/40">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={boardImageUrl}
            alt="Look board"
            className="w-full object-cover"
          />
        </div>
      ) : null}
      {displayLooks.map((look, i) => (
        <div key={`${look.label}-${i}`}>
          <p className="text-sm font-medium text-aura-foreground">
            {look.label ?? `Look ${i + 1}`}
            {look.tagline ? (
              <span className="ml-2 text-xs font-normal text-aura-muted">
                {look.tagline}
              </span>
            ) : null}
          </p>
          <LookShopList look={look} />
        </div>
      ))}
    </div>
  );
}
