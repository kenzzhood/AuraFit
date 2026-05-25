"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  const phKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;

  const inner = (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  if (phKey) {
    return (
      <PostHogProvider
        apiKey={phKey}
        options={{
          api_host:
            process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
          person_profiles: "identified_only",
          capture_pageview: true,
        }}
      >
        {inner}
      </PostHogProvider>
    );
  }

  return inner;
}
