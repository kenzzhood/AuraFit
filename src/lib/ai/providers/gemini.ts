import type { PlannedLook, PersonAnalysis } from "@/types/generation";
import type {
  AIProvider,
  AnalyzePersonInput,
  ChatMessageInput,
  GenerateLooksInput,
} from "./types";

/**
 * Gemini provider stub — wire @google/generative-ai when GEMINI_API_KEY is set.
 */
export const geminiAIProvider: AIProvider = {
  name: "gemini",

  isConfigured() {
    return false;
  },

  async analyzePerson(_input: AnalyzePersonInput): Promise<PersonAnalysis | null> {
    throw new Error("Gemini analyzePerson not wired yet — set AI_PROVIDERS=azure,openai");
  },

  async generateLooks(_input: GenerateLooksInput): Promise<PlannedLook[]> {
    throw new Error("Gemini generateLooks not wired yet");
  },

  async *generateChat(_messages: ChatMessageInput[]): AsyncGenerator<string> {
    throw new Error("Gemini chat not wired yet");
    yield "";
  },

  async generateEmbeddings(_text: string) {
    throw new Error("Gemini embeddings not wired yet");
  },
};
