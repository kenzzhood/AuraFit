"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AnalyticsGate } from "@/components/analytics/AnalyticsGate";
import { ConsentBar } from "@/components/analytics/ConsentBar";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={client}>
      {children}
      <AnalyticsGate />
      <ConsentBar />
    </QueryClientProvider>
  );
}
