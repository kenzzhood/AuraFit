import type {
  ProviderAttempt,
  ProviderFailure,
  ProviderMeta,
  ProviderResult,
} from "./types";

export async function runWithFallbacks<T>(params: {
  system: string;
  attempts: ProviderAttempt<T>[];
  /** If true, empty arrays / null are treated as failure for that provider */
  rejectEmpty?: (value: T) => boolean;
}): Promise<ProviderResult<T>> {
  const failures: ProviderFailure[] = [];
  const providersUsed: string[] = [];

  for (const attempt of params.attempts) {
    if (!attempt.configured()) {
      failures.push({
        system: params.system,
        provider: attempt.name,
        message: "Not configured",
      });
      continue;
    }

    try {
      const value = await attempt.run();
      const empty = params.rejectEmpty?.(value) ?? false;
      if (empty) {
        failures.push({
          system: params.system,
          provider: attempt.name,
          message: "Returned empty result",
        });
        continue;
      }
      providersUsed.push(attempt.name);
      const meta: ProviderMeta = {
        degraded: failures.length > 0,
        failures: failures.length ? [...failures] : undefined,
        providersUsed,
      };
      return { value, meta };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`[${params.system}] ${attempt.name} failed:`, message);
      failures.push({
        system: params.system,
        provider: attempt.name,
        message,
      });
    }
  }

  throw new AggregateError(
    failures.map((f) => new Error(`${f.provider}: ${f.message}`)),
    failures.map((f) => `${f.provider}: ${f.message}`).join("; ")
  );
}

export function mergeProviderMeta(
  ...parts: (ProviderMeta | undefined)[]
): ProviderMeta {
  const failures: ProviderFailure[] = [];
  const providersUsed: string[] = [];
  let degraded = false;

  for (const p of parts) {
    if (!p) continue;
    if (p.degraded) degraded = true;
    if (p.failures) failures.push(...p.failures);
    if (p.providersUsed) providersUsed.push(...p.providersUsed);
  }

  return {
    degraded: degraded || failures.length > 0,
    failures: failures.length ? failures : undefined,
    providersUsed: providersUsed.length ? [...new Set(providersUsed)] : undefined,
  };
}
