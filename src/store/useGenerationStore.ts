import { create } from "zustand";

type GenState = {
  jobId: string | null;
  status: "idle" | "queued" | "processing" | "done" | "error";
  progress: number;
  error: string | null;
  setJob: (id: string | null) => void;
  setStatus: (s: GenState["status"]) => void;
  setProgress: (n: number) => void;
  setError: (e: string | null) => void;
  reset: () => void;
};

export const useGenerationStore = create<GenState>((set) => ({
  jobId: null,
  status: "idle",
  progress: 0,
  error: null,
  setJob: (jobId) => set({ jobId }),
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      jobId: null,
      status: "idle",
      progress: 0,
      error: null,
    }),
}));
