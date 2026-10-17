"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type PublicCatalogItem = {
  key: string;
  kind: "subscription" | "credit_pack";
  tier?: string;
  name: string;
  description: string;
  amountMinor: number;
  currency: string;
  interval?: string;
  boards?: number;
  hdRenders?: number;
  wardrobeLimit?: number;
  chatMessagesPerDay?: number;
  highlight?: boolean;
  badge?: string;
  displayPrice: string;
};

export function PricingCards({
  items,
  billingEnabled,
  signedIn,
  trialDays = 7,
}: {
  items: PublicCatalogItem[];
  billingEnabled: boolean;
  signedIn: boolean;
  trialDays?: number;
}) {
  const router = useRouter();
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plans = items.filter(
    (i) =>
      i.kind === "subscription" &&
      (i.key === "free" ||
        (i.currency === currency && i.interval === interval))
  );
  const packs = items.filter(
    (i) => i.kind === "credit_pack" && i.currency === currency
  );

  async function checkout(catalogKey: string) {
    setError(null);
    if (!signedIn) {
      router.push(`/sign-up?redirect_url=${encodeURIComponent("/pricing")}`);
      return;
    }
    if (!billingEnabled) {
      setError("Paid plans are not open yet. You can keep using Free.");
      return;
    }
    setBusyKey(catalogKey);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogKey }),
      });
      const data = (await res.json()) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) {
        throw new Error(data.error ?? "Checkout failed");
      }
      window.location.href = data.checkoutUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-12">
      {trialDays > 0 && (
        <p className="max-w-2xl text-sm text-aura-muted">
          New accounts get {trialDays} days of Plus free (no card). After that you
          stay on Free forever — upgrade only when you want more boards and HD.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex rounded-sm border border-aura-border p-0.5 text-xs">
          {(["INR", "USD"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={
                currency === c
                  ? "bg-aura-raised px-3 py-1.5 text-aura-champagne"
                  : "px-3 py-1.5 text-aura-dim"
              }
            >
              {c === "INR" ? "India ₹" : "Global $"}
            </button>
          ))}
        </div>
        <div className="flex rounded-sm border border-aura-border p-0.5 text-xs">
          {(["month", "year"] as const).map((iv) => (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval(iv)}
              className={
                interval === iv
                  ? "bg-aura-raised px-3 py-1.5 text-aura-champagne"
                  : "px-3 py-1.5 text-aura-dim"
              }
            >
              {iv === "month" ? "Monthly" : "Yearly · 2 months free"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.key}
            className={
              plan.highlight
                ? "border border-aura-champagne/40 bg-aura-raised/40 p-6"
                : "border border-aura-border bg-aura-stage/40 p-6"
            }
          >
            {plan.badge && (
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-aura-champagne">
                {plan.badge}
              </p>
            )}
            <h3 className="mt-2 font-display text-xl text-aura-foreground">
              {plan.name}
            </h3>
            <p className="mt-2 text-sm text-aura-muted">{plan.description}</p>
            <p className="mt-6 font-display text-3xl text-aura-champagne">
              {plan.amountMinor === 0 ? "Free" : plan.displayPrice}
              {plan.interval && plan.amountMinor > 0 && (
                <span className="ml-1 text-sm text-aura-dim">
                  /{plan.interval === "year" ? "year" : "mo"}
                </span>
              )}
            </p>
            <ul className="mt-6 space-y-2 text-sm text-aura-dim">
              <li>{plan.boards ?? 0} style boards / month</li>
              <li>{plan.hdRenders ?? 0} HD renders / month</li>
              <li>{plan.wardrobeLimit ?? 40} wardrobe items</li>
              <li>{plan.chatMessagesPerDay ?? 15} stylist chats / day</li>
            </ul>
            {plan.key === "free" ? (
              <Link
                href={signedIn ? "/generate" : "/sign-up"}
                className="mt-8 inline-flex border border-aura-borderBright px-4 py-2 text-sm text-aura-foreground transition hover:border-aura-champagne/40"
              >
                {signedIn ? "Open studio" : `Start free${trialDays ? ` · ${trialDays}-day Plus trial` : ""}`}
              </Link>
            ) : (
              <button
                type="button"
                disabled={busyKey === plan.key}
                onClick={() => checkout(plan.key)}
                className="mt-8 inline-flex border border-aura-champagne/50 px-4 py-2 text-sm text-aura-champagne transition hover:bg-aura-champagne/10 disabled:opacity-50"
              >
                {busyKey === plan.key
                  ? "Redirecting…"
                  : plan.tier === "plus" && !signedIn
                    ? "Try Plus free"
                    : "Subscribe with Razorpay"}
              </button>
            )}
          </article>
        ))}
      </div>

      {packs.length > 0 && (
        <section>
          <h3 className="font-display text-lg text-aura-foreground">Credit packs</h3>
          <p className="mt-2 text-sm text-aura-muted">
            One-time board credits — separate from clothing checkout at retailers.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {packs.map((pack) => (
              <article
                key={pack.key}
                className="flex items-center justify-between border border-aura-border px-5 py-4"
              >
                <div>
                  <p className="text-sm font-medium text-aura-foreground">{pack.name}</p>
                  <p className="text-xs text-aura-dim">{pack.displayPrice}</p>
                </div>
                <button
                  type="button"
                  disabled={busyKey === pack.key}
                  onClick={() => checkout(pack.key)}
                  className="text-sm text-aura-champagne underline-offset-4 hover:underline disabled:opacity-50"
                >
                  Buy
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-aura-dim">
        Payments via Razorpay (UPI, cards, netbanking). Digital styling only —
        clothing stays on retailer sites.{" "}
        <Link href="/legal/refund" className="underline underline-offset-2">
          Refunds
        </Link>
        {" · "}
        <Link href="/legal/affiliate" className="underline underline-offset-2">
          Affiliates
        </Link>
        .
      </p>
    </div>
  );
}
