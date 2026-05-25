import { parseProviderOrder } from "@/lib/providers/env";
import { runWithFallbacks } from "@/lib/providers/fallback";
import type { ProviderResult } from "@/lib/providers/types";
import { replicateTryOnProvider } from "./providers/replicate";
import { noopTryOnProvider } from "./providers/noop";
import type { TryOnInput, TryOnProvider, TryOnResult } from "./providers/types";

const REGISTRY: Record<string, TryOnProvider> = {
  replicate: replicateTryOnProvider,
  noop: noopTryOnProvider,
};

export function getTryOnProvidersOrdered(): TryOnProvider[] {
  const order = parseProviderOrder("TRYON_PROVIDERS", ["replicate", "noop"]);
  return order
    .map((name) => REGISTRY[name])
    .filter((p): p is TryOnProvider => !!p);
}

export async function runTryOnWithFallback(
  input: TryOnInput
): Promise<ProviderResult<TryOnResult>> {
  const providers = getTryOnProvidersOrdered();
  return runWithFallbacks({
    system: "tryon",
    attempts: providers.map((p) => ({
      name: p.name,
      configured: () => p.name === "noop" || p.isConfigured(),
      run: () => p.runTryOn(input),
    })),
    rejectEmpty: (r) => !r.available && !r.message,
  });
}

export type { TryOnInput, TryOnResult } from "./providers/types";
