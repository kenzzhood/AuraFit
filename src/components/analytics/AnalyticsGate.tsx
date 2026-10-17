"use client";

import { useEffect, useRef } from "react";
import {
  CONSENT_EVENT,
  consentAllowsAnalytics,
  readConsent,
  type ConsentChoice,
} from "@/lib/analytics/consent";
import "@/lib/analytics/globals";

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function initGa4(measurementId: string) {
  await loadScript(
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`,
    "aurafit-ga4"
  );
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("consent", "default", { analytics_storage: "granted" });
  window.gtag("config", measurementId);
}

async function initClarity(projectId: string) {
  await loadScript(
    `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`,
    "aurafit-clarity"
  );
}

async function initMixpanel(token: string) {
  await loadScript(
    "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js",
    "aurafit-mixpanel"
  );
  if (window.mixpanel?.init) {
    window.mixpanel.init(token, { track_pageview: true });
  }
}

let posthogInitialized = false;

async function initPostHog(apiKey: string) {
  if (posthogInitialized) return;
  const mod = await import("posthog-js");
  const posthog = mod.default;
  posthog.init(apiKey, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
  });
  posthogInitialized = true;
}

async function applyConsentToLoadedSdks(choice: ConsentChoice) {
  const allow = consentAllowsAnalytics(choice);
  try {
    if (posthogInitialized) {
      const mod = await import("posthog-js");
      const posthog = mod.default;
      if (allow) posthog.opt_in_capturing();
      else posthog.opt_out_capturing();
    }
  } catch {
    /* ignore */
  }
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: allow ? "granted" : "denied",
    });
  }
  if (allow && typeof window.mixpanel?.opt_in_tracking === "function") {
    window.mixpanel.opt_in_tracking();
  }
  if (!allow && typeof window.mixpanel?.opt_out_tracking === "function") {
    window.mixpanel.opt_out_tracking();
  }
  if (typeof window.clarity === "function") {
    try {
      window.clarity("consent", allow);
    } catch {
      /* ignore */
    }
  }
}

async function injectAnalyticsScripts() {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  if (gaId) {
    try {
      await initGa4(gaId);
    } catch {
      /* ignore */
    }
  }

  const clarityId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim();
  if (clarityId) {
    try {
      await initClarity(clarityId);
    } catch {
      /* ignore */
    }
  }

  const mixToken = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim();
  if (mixToken) {
    try {
      await initMixpanel(mixToken);
    } catch {
      /* ignore */
    }
  }

  const phKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (phKey) {
    try {
      await initPostHog(phKey);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Loads optional analytics scripts only after the user accepts consent.
 * Listens for consent changes so Accept on the same page starts scripts without reload.
 */
export function AnalyticsGate() {
  const injected = useRef(false);

  useEffect(() => {
    const maybeInject = (choice: ConsentChoice | null) => {
      if (!consentAllowsAnalytics(choice)) {
        if (injected.current) void applyConsentToLoadedSdks("rejected");
        return;
      }
      if (injected.current) {
        void applyConsentToLoadedSdks("accepted");
        return;
      }
      injected.current = true;
      void injectAnalyticsScripts();
    };

    maybeInject(readConsent());

    const onChange = (ev: Event) => {
      const detail = (ev as CustomEvent<{ choice?: ConsentChoice }>).detail;
      maybeInject(detail?.choice ?? readConsent());
    };

    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  return null;
}
