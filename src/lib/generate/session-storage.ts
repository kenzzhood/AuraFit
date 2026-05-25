import type { JobStatus } from "@prisma/client";
import type { GenerationJobResult, GenerationLookResult } from "@/types/generation";

const STORAGE_KEY = "aurafit-generate-session";

export type GenerateSessionState = {
  step: number;
  path: "online" | "wardrobe";
  userPhotoUrl: string | null;
  styleType: string;
  occasion: string;
  location: string;
  budgetMin: number;
  budgetMax: number;
  style: string;
  wardrobeItemIds: string[];
  /** Sub-mode when path === "wardrobe". Defaults to "mix" when missing. */
  wardrobeMode?: "mix" | "pair";
  jobId: string | null;
  boardImageUrl: string | null;
  looks: GenerationLookResult[];
  selectedLook: number | null;
  doneJobStatus?: JobStatus;
  doneJobError?: string | null;
  doneJobResult?: GenerationJobResult | null;
};

export function loadGenerateSession(): GenerateSessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GenerateSessionState;
  } catch {
    return null;
  }
}

export function saveGenerateSession(state: GenerateSessionState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota or private mode */
  }
}

export function clearGenerateSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
