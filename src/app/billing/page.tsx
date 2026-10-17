"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";

type Snapshot = {
  billingEnabled: boolean;
  planKey: string;
  tier: string;
  status: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  onTrial?: boolean;
  boards: { available: number; planRemaining: number; creditBalance: number };
  hd: { available: number; planRemaining: number; creditBalance: number };
};

type Tx = {
  id: string;
  catalogKey: string;
  status: string;
  amount: string;
  createdAt: string;
};

export default function BillingPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [eRes, hRes] = await Promise.all([
          fetch("/api/billing/entitlement"),
          fetch("/api/billing/history"),
        ]);
        if (!eRes.ok) throw new Error("Could not load entitlement");
        setSnap((await eRes.json()) as Snapshot);
        if (hRes.ok) {
          const data = (await hRes.json()) as { transactions: Tx[] };
          setTxs(data.transactions ?? []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load billing");
      }
    })();
  }, []);

  async function cancel() {
    setCanceling(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Cancel failed");
      setSnap((s) => (s ? { ...s, cancelAtPeriodEnd: true } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCanceling(false);
    }
  }

  return (
      <div className="mx-auto max-w-2xl space-y-10">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-aura-sage">
            Account
          </p>
          <h1 className="mt-2 font-display text-2xl text-aura-foreground">Billing</h1>
          <p className="mt-2 text-sm text-aura-muted">
            Aurafit digital plan and credits. Clothing purchases stay on retailer sites.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        )}

        {!snap && !error && (
          <div className="space-y-4 border border-aura-border p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {snap && (
          <section className="space-y-4 border border-aura-border p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-aura-dim">Current plan</p>
            <p className="font-display text-xl capitalize text-aura-champagne">
              {snap.onTrial ? "Plus trial" : snap.tier}
            </p>
            <p className="text-sm text-aura-muted">
              Status: {snap.status}
              {snap.onTrial && snap.periodEnd
                ? ` · trial ends ${new Date(snap.periodEnd).toLocaleDateString()} then Free`
                : snap.periodEnd
                  ? ` · period ends ${new Date(snap.periodEnd).toLocaleDateString()}`
                  : ""}
              {!snap.onTrial && snap.cancelAtPeriodEnd
                ? " · cancels at period end"
                : ""}
            </p>
            <ul className="space-y-1 text-sm text-aura-dim">
              <li>
                Boards available: {snap.boards.available} (plan {snap.boards.planRemaining} +
                credits {snap.boards.creditBalance})
              </li>
              <li>
                HD available: {snap.hd.available} (plan {snap.hd.planRemaining} + credits{" "}
                {snap.hd.creditBalance})
              </li>
            </ul>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/pricing"
                className="text-sm text-aura-champagne underline-offset-4 hover:underline"
              >
                Change plan
              </Link>
              {!snap.onTrial &&
                !snap.cancelAtPeriodEnd &&
                snap.tier !== "free" && (
                <button
                  type="button"
                  disabled={canceling}
                  onClick={() => void cancel()}
                  className="text-sm text-aura-dim underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {canceling ? "Updating…" : "Cancel at period end"}
                </button>
              )}
              {snap.onTrial && (
                <Link
                  href="/pricing"
                  className="text-sm text-aura-champagne underline-offset-4 hover:underline"
                >
                  Keep Plus after trial
                </Link>
              )}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-sm font-medium text-aura-foreground">Payment history</h2>
          {txs.length === 0 ? (
            <p className="mt-3 text-sm text-aura-dim">No payments yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-aura-border border border-aura-border">
              {txs.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <span className="text-aura-dim">
                    {t.catalogKey} · {t.status}
                  </span>
                  <span className="text-aura-foreground">{t.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-aura-dim">
          <Link href="/legal/refund" className="underline underline-offset-2">
            Refunds
          </Link>
          {" · "}
          <Link href="/legal/terms" className="underline underline-offset-2">
            Terms
          </Link>
          {" · "}
          <Link href="/legal/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
        </p>
      </div>
  );
}
