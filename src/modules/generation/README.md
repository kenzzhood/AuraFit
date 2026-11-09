# generation

Typed contract: `index.ts`.

```
export const GPT_IMAGE_MODEL = "gpt-image-2-2026-04-21";
export const IMAGE_RPM = 6;
export const CORE_MODEL_IDS = [
export function isCoreModel(modelId: string): boolean
export type GenerationRoute =
export function routeGeneration(input:
export interface RenderPair
export interface RenderJob
export function planNightRender(input:
export function renderPriority(kind: "live" | "ondemand" | "night"): number
export function readGenerationConfig(env: Record<string, string | undefined> = process.env)
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
