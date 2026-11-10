/** Newest GPT image model confirmed on Azure OpenAI (Microsoft Foundry), GA. */
export const IMAGE_MODEL_DEFAULT = "gpt-image-2.5-sunburst";
export const IMAGE_MODEL_VERSION = "2026-09-08";
/** Microsoft retirement schedule. No replacement is named. */
export const IMAGE_MODEL_RETIRES_ON = "2027-09-08";
/** gpt-image-2 retires later. It is not the store default. */
export const PRIOR_IMAGE_MODEL_RETIRES_ON = "2027-10-21";
/** Drop-in once Azure lists it. Not selected until then. */
export const IMAGE_MODEL_UPGRADE = "gpt-image-2.6-sunburst";
export const IMAGE_RPM = 6;
/** Current board size and qualities. 2.5 also accepts xhigh, max, and custom sizes. */
export const IMAGE_SIZE = "1536x1024";
export const IMAGE_QUALITIES = ["low", "medium", "high"] as const;

const KNOWN_RETIREMENTS: Record<string, string> = {
  [IMAGE_MODEL_DEFAULT]: IMAGE_MODEL_RETIRES_ON,
  "gpt-image-2": PRIOR_IMAGE_MODEL_RETIRES_ON,
  "gpt-image-2-2026-04-21": PRIOR_IMAGE_MODEL_RETIRES_ON,
};

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
  | {
      kind: "personal";
      backend: "azure-gpt-image";
      model: string;
      faceEdit: boolean;
      reason: string;
    }
  | {
      kind: "model";
      backend: "azure-gpt-image";
      model: string;
      faceEdit: false;
      reason: string;
    }
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
    return {
      kind: "model",
      backend: "azure-gpt-image",
      model: readGenerationConfig().model,
      faceEdit: false,
      reason: "synthetic_child_model",
    };
  }
  const model = readGenerationConfig().model;
  if (MODEL_ONLY.has(input.category)) {
    return {
      kind: "model",
      backend: "azure-gpt-image",
      model,
      faceEdit: false,
      reason: "model_only_category",
    };
  }
  if (!input.hasShopperPhoto) {
    return {
      kind: "model",
      backend: "azure-gpt-image",
      model,
      faceEdit: false,
      reason: "no_photo",
    };
  }
  if (input.quotaRemaining <= 0) {
    return {
      kind: "personal",
      backend: "azure-gpt-image",
      model,
      faceEdit: false,
      reason: "whatsapp_queue",
    };
  }
  return {
    kind: "personal",
    backend: "azure-gpt-image",
    model,
    faceEdit: true,
    reason: "adult_try_on",
  };
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
  backend: "azure-gpt-image";
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
  const model = readGenerationConfig().model;
  return {
    paused: false,
    reason: "closed",
    jobs: ordered.map((pair) => ({
      lookId: pair.lookId,
      modelId: pair.modelId,
      backend: "azure-gpt-image" as const,
      modelVersion: model,
      phase: isCoreModel(pair.modelId) ? ("core" as const) : ("ondemand" as const),
    })),
  };
}

export interface StockModelRef {
  id: string;
  audience: "women" | "men" | "child";
  body: "slim" | "average" | "broad";
  tone: "t1" | "t2" | "t3";
}

/** The shopper sees the closest already-rendered model. Tone never leaves this function. */
export function nearestModel(models: StockModelRef[], want: StockModelRef): StockModelRef | null {
  const sameAudience = models.filter((model) => model.audience === want.audience);
  const pool = sameAudience.length > 0 ? sameAudience : models;
  if (pool.length === 0) return null;
  const bodyRank = { slim: 0, average: 1, broad: 2 };
  const toneRank = { t1: 0, t2: 1, t3: 2 };
  return [...pool].sort((a, b) => {
    const da =
      Math.abs(bodyRank[a.body] - bodyRank[want.body]) +
      Math.abs(toneRank[a.tone] - toneRank[want.tone]);
    const db =
      Math.abs(bodyRank[b.body] - bodyRank[want.body]) +
      Math.abs(toneRank[b.tone] - toneRank[want.tone]);
    return da - db;
  })[0];
}

export function renderPriority(kind: "live" | "ondemand" | "night"): number {
  if (kind === "live") return 0;
  if (kind === "ondemand") return 1;
  return 2;
}

export function readGenerationConfig(env: Record<string, string | undefined> = process.env) {
  const model = env.AURAFIT_IMAGE_MODEL?.trim() || IMAGE_MODEL_DEFAULT;
  return {
    model,
    version: model === IMAGE_MODEL_DEFAULT ? IMAGE_MODEL_VERSION : null,
    retiresOn: KNOWN_RETIREMENTS[model] ?? null,
    provider: "azure-openai" as const,
    rpm: IMAGE_RPM,
    personalCap: 3,
    asyncAfterMs: 45_000,
    size: IMAGE_SIZE,
    qualities: IMAGE_QUALITIES,
  };
}

/** Warn once the configured model is inside 90 days of its known retirement date. */
export function imageRetirementWarning(now: Date): string | null {
  const config = readGenerationConfig();
  if (!config.retiresOn) return null;
  const retire = Date.parse(`${config.retiresOn}T00:00:00.000Z`);
  const days = (retire - now.getTime()) / 86_400_000;
  if (days >= 90) return null;
  return `Azure image model ${config.model} retires on ${config.retiresOn}. Microsoft names no replacement. The planned swap is ${IMAGE_MODEL_UPGRADE} once Azure lists it.`;
}
