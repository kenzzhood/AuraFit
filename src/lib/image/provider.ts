import { parseProviderOrder } from "@/lib/providers/env";
import { runWithFallbacks } from "@/lib/providers/fallback";
import type { ProviderResult } from "@/lib/providers/types";
import { azureImageProvider } from "./providers/azure";
import { openaiImageProvider } from "./providers/openai";
import { noopImageProvider } from "./providers/noop";
import type {
  FashionBoardImage,
  GenerateBoardInput,
  ImageProvider,
} from "./providers/types";

const REGISTRY: Record<string, ImageProvider> = {
  azure: azureImageProvider,
  openai: openaiImageProvider,
  noop: noopImageProvider,
};

export function getImageProvidersOrdered(): ImageProvider[] {
  const order = parseProviderOrder("IMAGE_PROVIDERS", ["azure", "openai", "noop"]);
  return order
    .map((name) => REGISTRY[name])
    .filter((p): p is ImageProvider => !!p);
}

export function isImageGenerationConfigured(): boolean {
  return getImageProvidersOrdered().some(
    (p) => p.name !== "noop" && p.isConfigured()
  );
}

export async function generateBoardWithFallback(
  input: GenerateBoardInput
): Promise<ProviderResult<FashionBoardImage>> {
  const providers = getImageProvidersOrdered();
  return runWithFallbacks({
    system: "image",
    attempts: providers.map((p) => ({
      name: p.name,
      configured: () => p.name === "noop" || p.isConfigured(),
      run: () => p.generateBoard(input),
    })),
    rejectEmpty: (img) => !img.url && !img.buffer,
  });
}

/** @deprecated use generateBoardWithFallback */
export async function generateFashionBoard(prompt: string) {
  const { value } = await generateBoardWithFallback({ prompt, quality: "hd" });
  return value;
}

export type { FashionBoardImage } from "./providers/types";
