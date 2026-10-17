import type { AIProvider } from "@/lib/ai/providers/types";
import { azureAIProvider } from "@/lib/ai/providers/azure";
import { openaiAIProvider } from "@/lib/ai/providers/openai";
import { geminiAIProvider } from "@/lib/ai/providers/gemini";
import { parseProviderOrder } from "@/lib/providers/env";
import { runWithFallbacks } from "@/lib/providers/fallback";
import type { ProviderResult } from "@/lib/providers/types";
import type {
  AnalyzePersonInput,
  GenerateLooksInput,
  GenerateLooksResult,
} from "@/lib/ai/providers/types";
import type { PersonAnalysis } from "@/types/generation";

export { isImageGenerationConfigured } from "@/lib/image/provider";

const REGISTRY: Record<string, AIProvider> = {
  azure: azureAIProvider,
  openai: openaiAIProvider,
  gemini: geminiAIProvider,
};

export type AIProviderName = "azure" | "openai" | "gemini";

export function getAIProvidersOrdered(): AIProvider[] {
  const legacy = process.env.AI_PROVIDER?.toLowerCase();
  const order = parseProviderOrder(
    "AI_PROVIDERS",
    legacy ? [legacy, "azure", "openai"] : ["azure", "openai"]
  );
  const seen = new Set<string>();
  const list: AIProvider[] = [];
  for (const name of order) {
    if (seen.has(name)) continue;
    if (name === "openai" && process.env.ALLOW_OPENAI_AI_FALLBACK !== "true") {
      continue;
    }
    const p = REGISTRY[name];
    if (p && (name !== "gemini" || p.isConfigured())) {
      seen.add(name);
      list.push(p);
    }
  }
  return list;
}

/** First configured provider (for chat/embeddings that don't need fallback) */
export function getAIProvider(): AIProvider {
  const ordered = getAIProvidersOrdered();
  const configured = ordered.find((p) => p.isConfigured());
  return configured ?? azureAIProvider;
}

export function getAIProviderName(): AIProviderName {
  const name = getAIProvider().name;
  if (name === "openai" || name === "gemini") return name;
  return "azure";
}

export async function analyzePersonWithFallback(
  input: AnalyzePersonInput
): Promise<ProviderResult<PersonAnalysis | null>> {
  return runWithFallbacks({
    system: "ai",
    attempts: getAIProvidersOrdered().map((p) => ({
      name: p.name,
      configured: () => p.isConfigured(),
      run: () => p.analyzePerson(input),
    })),
  });
}

export async function generateLooksWithFallback(
  input: GenerateLooksInput
): Promise<ProviderResult<GenerateLooksResult>> {
  return runWithFallbacks({
    system: "ai",
    attempts: getAIProvidersOrdered().map((p) => ({
      name: p.name,
      configured: () => p.isConfigured(),
      run: () => p.generateLooks(input),
    })),
    rejectEmpty: (result) => !result.looks.length,
  });
}
