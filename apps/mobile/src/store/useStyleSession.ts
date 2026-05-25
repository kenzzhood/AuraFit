import { create } from "zustand";
import type { GenerateInput, GenerationJobResult } from "@/api/types";

type StyleSession = {
  localPhotoUri: string | null;
  remotePhotoUrl: string | null;
  preferences: Partial<GenerateInput>;
  jobId: string | null;
  result: GenerationJobResult | null;
  selectedLookIndex: number | null;
  setLocalPhoto: (uri: string | null) => void;
  setRemotePhotoUrl: (url: string | null) => void;
  setPreferences: (prefs: Partial<GenerateInput>) => void;
  setJobId: (id: string | null) => void;
  setResult: (result: GenerationJobResult | null) => void;
  setSelectedLook: (index: number | null) => void;
  reset: () => void;
};

const initial = {
  localPhotoUri: null,
  remotePhotoUrl: null,
  preferences: {
    path: "online" as const,
    styleType: "Smart casual",
    budgetMin: 2000,
    budgetMax: 6000,
    previewOnly: true,
  },
  jobId: null,
  result: null,
  selectedLookIndex: null,
};

export const useStyleSession = create<StyleSession>((set) => ({
  ...initial,
  setLocalPhoto: (uri) => set({ localPhotoUri: uri }),
  setRemotePhotoUrl: (url) => set({ remotePhotoUrl: url }),
  setPreferences: (prefs) =>
    set((s) => ({ preferences: { ...s.preferences, ...prefs } })),
  setJobId: (id) => set({ jobId: id }),
  setResult: (result) => set({ result }),
  setSelectedLook: (index) => set({ selectedLookIndex: index }),
  reset: () => set(initial),
}));
