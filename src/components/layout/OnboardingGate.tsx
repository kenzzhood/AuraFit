"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export function OnboardingGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(pathname === "/onboarding");

  useEffect(() => {
    if (pathname === "/onboarding") {
      setReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/me");
        if (!r.ok) {
          if (!cancelled) setReady(true);
          return;
        }
        const data = (await r.json()) as {
          user?: { onboardingStatus?: string };
        };
        if (!cancelled) {
          if (data.user?.onboardingStatus !== "COMPLETED") {
            router.replace("/onboarding");
            return;
          }
          setReady(true);
        }
      } catch {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <p className="text-sm text-aura-muted">Loading your atelier profile…</p>
    );
  }

  return children;
}
