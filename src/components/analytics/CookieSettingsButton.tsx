"use client";

import { dispatchConsentOpen } from "@/lib/analytics/consent";

/** Reopens the consent bar (Cookie settings). */
export function CookieSettingsButton({
  className,
}: {
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => dispatchConsentOpen()}
      className={
        className ??
        "hover:text-aura-champagne text-left underline-offset-2 hover:underline"
      }
    >
      Cookie settings
    </button>
  );
}
