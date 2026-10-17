import {
  consentAllowsAnalytics,
  readConsent,
  type ConsentChoice,
} from "./consent";
import "./globals";

/**
 * Fire a product analytics event only when consent is accepted.
 * Never throws. Fans out to PostHog / gtag / Mixpanel when present.
 */
export function track(
  event: string,
  props?: Record<string, unknown>
): void {
  try {
    const choice: ConsentChoice | null = readConsent();
    if (!consentAllowsAnalytics(choice)) return;

    if (typeof window === "undefined") return;

    const phKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (phKey) {
      void import("posthog-js")
        .then((mod) => {
          const posthog = mod.default;
          if (posthog?.capture) posthog.capture(event, props);
        })
        .catch(() => {
          /* ignore */
        });
    }

    if (typeof window.gtag === "function") {
      window.gtag("event", event, props ?? {});
    }

    if (typeof window.mixpanel?.track === "function") {
      window.mixpanel.track(event, props);
    }
  } catch {
    /* never throw from analytics */
  }
}
