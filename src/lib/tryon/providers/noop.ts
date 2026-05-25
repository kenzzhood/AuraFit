import type { TryOnInput, TryOnProvider, TryOnResult } from "./types";

export const noopTryOnProvider: TryOnProvider = {
  name: "noop",
  isConfigured: () => true,
  async runTryOn(_input: TryOnInput): Promise<TryOnResult> {
    return {
      available: false,
      message: "Try-on unavailable, outfit details still ready.",
    };
  },
};
