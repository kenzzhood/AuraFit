"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CONSENT_EVENT,
  CONSENT_OPEN_EVENT,
  dispatchConsentChange,
  readConsent,
  writeConsent,
  type ConsentChoice,
} from "@/lib/analytics/consent";

async function persistConsentServer(accepted: boolean) {
  try {
    const res = await fetch("/api/me/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted }),
    });
    // Signed-out users get 401 — ignore
    void res;
  } catch {
    /* ignore network errors */
  }
}

/**
 * Compact fixed bottom consent bar. Shows when consent is unset or reopened via Cookie settings.
 */
export function ConsentBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readConsent() === null);

    const onOpen = () => setVisible(true);
    const onChange = () => {
      // Keep bar hidden after a choice unless reopened
      if (readConsent() !== null) setVisible(false);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, onOpen);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => {
      window.removeEventListener(CONSENT_OPEN_EVENT, onOpen);
      window.removeEventListener(CONSENT_EVENT, onChange);
    };
  }, []);

  const choose = useCallback((choice: ConsentChoice) => {
    writeConsent(choice);
    dispatchConsentChange(choice);
    void persistConsentServer(choice === "accepted");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie and analytics consent"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-aura-border bg-aura-stage/95 px-4 py-4 shadow-[0_-8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md md:px-8"
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl text-sm leading-relaxed text-aura-dim">
          <p className="text-aura-foreground">
            We use optional analytics (Google Analytics, Microsoft Clarity,
            Mixpanel, PostHog) to improve Aurafit.
          </p>
          <p className="mt-1.5 text-xs">
            Auth cookies stay either way.{" "}
            <Link
              href="/legal/privacy"
              className="text-aura-champagne underline-offset-2 hover:underline"
            >
              Privacy
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="min-h-[44px] flex-1 rounded-sm border border-aura-border px-5 py-2.5 text-sm font-medium text-aura-foreground transition-colors hover:border-aura-borderBright hover:bg-aura-raised/50 sm:flex-none"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="min-h-[44px] flex-1 rounded-sm border border-aura-champagne/35 bg-aura-champagne px-5 py-2.5 text-sm font-semibold text-aura-void transition-colors hover:bg-[#c9a882] sm:flex-none"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
