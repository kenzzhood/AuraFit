export const GPT_IMAGE_MODEL = "gpt-image-2-2026-04-21";
export const IMAGE_RPM = 6;

export const CORE_MODEL_IDS = [
  "adult-women-average-t1",
  "adult-women-average-t2",
  "adult-women-average-t3",
  "adult-men-average-t1",
  "adult-men-average-t2",
  "adult-men-average-t3",
] as const;

export function isCoreModel(modelId: string): boolean {
  return (CORE_MODEL_IDS as readonly string[]).includes(modelId);
}

export type GenerationRoute =
  | { kind: "personal"; backend: "gpt-image-2" | "flux-klein"; reason: string }
  | { kind: "model"; backend: "gpt-image-2" | "flux-klein"; reason: string }
  | { kind: "blocked"; reason: string };

const MODEL_ONLY = new Set(["lingerie", "swimwear"]);

export function routeGeneration(input: {
  audience: "women" | "men" | "child";
  category: string;
  hasShopperPhoto: boolean;
  quotaRemaining: number;
}): GenerationRoute {
  if (input.audience === "child") {
    if (input.hasShopperPhoto) {
      return { kind: "blocked", reason: "no_child_photo" };
    }
    return { kind: "model", backend: "flux-klein", reason: "synthetic_child_model" };
  }
  if (MODEL_ONLY.has(input.category)) {
    return { kind: "model", backend: "gpt-image-2", reason: "model_only_category" };
  }
  if (!input.hasShopperPhoto) {
    return { kind: "model", backend: "gpt-image-2", reason: "no_photo" };
  }
  if (input.quotaRemaining <= 0) {
    return { kind: "personal", backend: "flux-klein", reason: "quota_fallback" };
  }
  return { kind: "personal", backend: "gpt-image-2", reason: "adult_try_on" };
}

export interface RenderPair {
  lookId: string;
  modelId: string;
  audience: "women" | "men" | "child";
  rendered: boolean;
}

export interface RenderJob {
  lookId: string;
  modelId: string;
  backend: "gpt-image-2" | "flux-klein";
  modelVersion: string;
  phase: "core" | "ondemand";
}

/** Night work waits while the store is open or a live try-on needs the quota. */
export function planNightRender(input: {
  storeOpen: boolean;
  liveDemand: boolean;
  pairs: RenderPair[];
}): { jobs: RenderJob[]; paused: boolean; reason: string } {
  if (input.storeOpen || input.liveDemand) {
    return {
      jobs: [],
      paused: true,
      reason: input.liveDemand ? "live_priority" : "store_open",
    };
  }
  const pending = input.pairs.filter((pair) => !pair.rendered);
  const core = pending.filter(
    (pair) => pair.audience !== "child" && isCoreModel(pair.modelId)
  );
  const rest = pending.filter((pair) => !core.includes(pair));
  const ordered = [...core, ...rest];
  return {
    paused: false,
    reason: "closed",
    jobs: ordered.map((pair) => ({
      lookId: pair.lookId,
      modelId: pair.modelId,
      backend: pair.audience === "child" ? "flux-klein" : "gpt-image-2",
      modelVersion: pair.audience === "child" ? "flux-klein-4b" : GPT_IMAGE_MODEL,
      phase: isCoreModel(pair.modelId) ? "core" : "ondemand",
    })),
  };
}

export function renderPriority(kind: "live" | "ondemand" | "night"): number {
  if (kind === "live") return 0;
  if (kind === "ondemand") return 1;
  return 2;
}

export function readGenerationConfig(env: Record<string, string | undefined> = process.env) {
  return {
    model: env.AURAFIT_GPT_IMAGE_MODEL ?? GPT_IMAGE_MODEL,
    rpm: IMAGE_RPM,
    personalCap: 3,
    asyncAfterMs: 45_000,
  };
}
