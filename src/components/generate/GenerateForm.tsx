"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery } from "@tanstack/react-query";
import posthog from "posthog-js";
import { JobStatus } from "@prisma/client";
import { GenerationProgress } from "./GenerationProgress";
import { LookSelector } from "./LookSelector";
import { LookDetailPanel } from "./LookDetailPanel";
import type { GenerationJobResult, GenerationLookResult } from "@/types/generation";
import {
  clearGenerateSession,
  loadGenerateSession,
  saveGenerateSession,
} from "@/lib/generate/session-storage";

const STYLE_TYPES = [
  "Smart casual",
  "Luxury casual",
  "Formal",
  "Semi-formal",
  "Streetwear",
  "Ethnic",
  "Partywear",
  "Business",
] as const;

type JobShape = {
  status: JobStatus;
  progress: number;
  result: GenerationJobResult | null;
  error: string | null;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      resolve(r.includes(",") ? r.split(",")[1]! : r);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function GenerateForm() {
  const restored = useRef(false);
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<"online" | "wardrobe">("online");
  const [userPhotoUrl, setUserPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [styleType, setStyleType] = useState("Smart casual");
  const [occasion, setOccasion] = useState("");
  const [location, setLocation] = useState("");
  const [budgetMin, setBudgetMin] = useState(2000);
  const [budgetMax, setBudgetMax] = useState(6000);
  const [style, setStyle] = useState("");
  const [wardrobeItemIds, setWardrobeItemIds] = useState<string[]>([]);
  const [wardrobeMode, setWardrobeMode] = useState<"mix" | "pair">("mix");
  const [jobId, setJobId] = useState<string | null>(null);
  const [boardImageUrl, setBoardImageUrl] = useState<string | null>(null);
  const [looks, setLooks] = useState<GenerationLookResult[]>([]);
  const [selectedLook, setSelectedLook] = useState<number | null>(null);
  const [doneJob, setDoneJob] = useState<JobShape | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [savedOutfitId, setSavedOutfitId] = useState<string | null>(null);

  const showError = (message: string) => {
    setFormSuccess(null);
    setFormError(message);
  };

  const showSuccess = (message: string) => {
    setFormError(null);
    setFormSuccess(message);
  };

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = loadGenerateSession();
    if (!saved) return;
    setStep(saved.step);
    setPath(saved.path);
    setUserPhotoUrl(saved.userPhotoUrl);
    setPhotoPreview(saved.userPhotoUrl);
    setStyleType(saved.styleType);
    setOccasion(saved.occasion);
    setLocation(saved.location);
    setBudgetMin(saved.budgetMin);
    setBudgetMax(saved.budgetMax);
    setStyle(saved.style);
    setWardrobeItemIds(saved.wardrobeItemIds);
    if (saved.wardrobeMode) setWardrobeMode(saved.wardrobeMode);
    setJobId(saved.jobId);
    setBoardImageUrl(saved.boardImageUrl);
    setLooks(saved.looks);
    setSelectedLook(saved.selectedLook);
    if (saved.doneJobStatus && saved.doneJobResult) {
      setDoneJob({
        status: saved.doneJobStatus,
        progress: 100,
        result: saved.doneJobResult,
        error: saved.doneJobError ?? null,
      });
    }
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    saveGenerateSession({
      step,
      path,
      userPhotoUrl,
      styleType,
      occasion,
      location,
      budgetMin,
      budgetMax,
      style,
      wardrobeItemIds,
      wardrobeMode,
      jobId,
      boardImageUrl,
      looks,
      selectedLook,
      doneJobStatus: doneJob?.status,
      doneJobError: doneJob?.error,
      doneJobResult: doneJob?.result ?? null,
    });
  }, [
    step,
    path,
    userPhotoUrl,
    styleType,
    occasion,
    location,
    budgetMin,
    budgetMax,
    style,
    wardrobeItemIds,
    wardrobeMode,
    jobId,
    boardImageUrl,
    looks,
    selectedLook,
    doneJob,
  ]);

  const wardrobeQ = useQuery({
    queryKey: ["wardrobe"],
    queryFn: async () => {
      const r = await fetch("/api/wardrobe");
      if (!r.ok) throw new Error("wardrobe");
      return r.json() as Promise<
        Array<{
          items: Array<{
            id: string;
            category: string;
            readUrl?: string;
            imageUrl?: string | null;
          }>;
        }>
      >;
    },
    enabled: path === "wardrobe" && step >= 1,
  });

  const wardrobeItems =
    wardrobeQ.data?.flatMap((w) => w.items.map((it) => ({ ...it }))) ?? [];

  // Tracks which wardrobe tile is mid-delete so we can show a spinner and
  // disable interaction without blocking the rest of the grid.
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const handleDeleteWardrobeItem = async (
    id: string,
    label: string
  ): Promise<void> => {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `Remove this ${label.toLowerCase()} from your wardrobe? This cannot be undone.`
      );
      if (!ok) return;
    }
    setDeletingItemId(id);
    try {
      const res = await fetch(`/api/wardrobe/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      // Drop from selection if it was an anchor and refresh the grid.
      setWardrobeItemIds((prev) => prev.filter((x) => x !== id));
      await wardrobeQ.refetch();
    } catch (e) {
      console.error("delete wardrobe item failed", e);
      showError(
        e instanceof Error ? e.message : "Failed to delete that piece."
      );
    } finally {
      setDeletingItemId((curr) => (curr === id ? null : curr));
    }
  };

  const finishedJobQ = useQuery({
    queryKey: ["generation-finished", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("Missing job id");
      const r = await fetch(`/api/generate/status/${jobId}`);
      if (!r.ok) throw new Error("Could not refresh generation");
      return r.json() as Promise<JobShape>;
    },
    enabled: step === 3 && !!jobId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const job = finishedJobQ.data;
    if (!job?.result) return;
    setDoneJob(job);
    if (job.result.boardImageUrl) setBoardImageUrl(job.result.boardImageUrl);
    if (job.result.looks?.length) setLooks(job.result.looks);
  }, [finishedJobQ.data]);

  const onDropPhoto = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setUploadingPhoto(true);
    try {
      const preview = URL.createObjectURL(f);
      setPhotoPreview(preview);
      const base64 = await fileToBase64(f);
      const up = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: f.name,
          contentType: f.type || "image/jpeg",
          kind: "profile",
          base64,
        }),
      });
      const data = await up.json();
      if (!up.ok) throw new Error(data.error ?? "Upload failed");
      setUserPhotoUrl(data.url as string);
    } catch (e) {
      setPhotoPreview(null);
      setUserPhotoUrl(null);
      showError(e instanceof Error ? e.message : "Photo upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropPhoto,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
    disabled: uploadingPhoto,
  });

  const toggleItem = (id: string) => {
    setWardrobeItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // The "Take a photo" button on mobile uses a hidden file input with the
  // capture attribute so iOS/Android open the camera directly instead of
  // the photo library. We reuse the same upload pipeline as the dropzone.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const handleCameraChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void onDropPhoto([f]);
      // Reset so picking the same photo twice still fires onChange.
      e.target.value = "";
    },
    [onDropPhoto]
  );

  // Auto-scroll the look detail panel into view on mobile when the user
  // taps a look number in the board. Skipped on lg+ where the panel is
  // already side-by-side with the board.
  const detailPanelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedLook == null) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    requestAnimationFrame(() => {
      detailPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [selectedLook]);

  const startGenerate = async () => {
    if (!userPhotoUrl) {
      throw new Error("Upload your photo first");
    }
    const r = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path,
        userPhotoUrl,
        styleType,
        occasion: occasion || undefined,
        location: location || undefined,
        // Mix-only mode never shops, so a budget hint would only confuse the
        // stylist. Drop the values so the LLM treats it as flexible/N-A.
        budgetMin:
          path === "wardrobe" && wardrobeMode === "mix"
            ? undefined
            : budgetMin,
        budgetMax:
          path === "wardrobe" && wardrobeMode === "mix"
            ? undefined
            : budgetMax,
        style: style || undefined,
        wardrobeItemIds:
          path === "wardrobe" && wardrobeItemIds.length
            ? wardrobeItemIds
            : undefined,
        wardrobeMode: path === "wardrobe" ? wardrobeMode : undefined,
        renderQuality: "medium",
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Failed");
    setJobId(data.jobId as string);
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.capture("generation_started", {
        path,
        job_id: data.jobId,
        has_photo: true,
      });
    }
  };

  const onJobComplete = useCallback((job: JobShape) => {
    setDoneJob(job);
    const r = job.result;
    if (r?.boardImageUrl) setBoardImageUrl(r.boardImageUrl);
    if (r?.looks?.length) {
      setLooks(r.looks);
    } else {
      setLooks(Array.from({ length: 6 }, (_, i) => ({
        label: `Look ${i + 1}`,
        productSearchQuery: "outfit",
        products: [],
      })));
    }
    setStep(3);
  }, []);

  const saveSnapshot = async () => {
    if (selectedLook == null) return;
    const snap = {
      lookIndex: selectedLook,
      path,
      styleType,
      occasion,
      location,
      budgetMin,
      budgetMax,
      style,
      boardImageUrl,
      looks,
      jobId,
    };
    const outfitId = doneJob?.result?.outfitId;
    const name = looks[selectedLook]?.label ?? `Look ${selectedLook + 1}`;

    const r = outfitId
      ? await fetch(`/api/outfits/${outfitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            occasion: occasion || undefined,
            isSaved: true,
            snapshot: snap,
          }),
        })
      : await fetch("/api/outfits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            occasion: occasion || undefined,
            isSaved: true,
            snapshot: snap,
          }),
        });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      showError(
        typeof data === "object" && data && "error" in data
          ? String((data as { error: unknown }).error)
          : "Save failed"
      );
      return;
    }
    const nextOutfitId =
      typeof data === "object" && data && "id" in data
        ? String((data as { id: unknown }).id)
        : outfitId;
    if (nextOutfitId) setSavedOutfitId(nextOutfitId);
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.capture("outfit_saved_from_generate", { lookIndex: selectedLook });
    }
    showSuccess("Saved to Outfits");
  };

  const resetSession = () => {
    clearGenerateSession();
    setStep(0);
    setJobId(null);
    setDoneJob(null);
    setBoardImageUrl(null);
    setLooks([]);
    setSelectedLook(null);
    setUserPhotoUrl(null);
    setPhotoPreview(null);
    setFormError(null);
    setFormSuccess(null);
    setSavedOutfitId(null);
  };

  // Maps the wizard's internal `step` (0..3) to the visible 3-step
  // indicator (Photo / Style / Generate). Step 2 is the in-flight progress
  // screen and step 3 is the result, both of which read as "Generate" in
  // the indicator so the user always sees a familiar three-stop journey.
  const indicatorSteps: { id: number; label: string }[] = [
    { id: 0, label: "Photo" },
    { id: 1, label: "Style" },
    { id: 2, label: "Generate" },
  ];
  const indicatorActive =
    step === 0 ? 0 : step === 1 ? 1 : 2;

  return (
    <div className="mx-auto max-w-5xl space-y-6 md:space-y-8">
      {(formError || formSuccess) && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm ${
            formError
              ? "border-red-400/20 bg-red-500/10 text-red-300"
              : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {formError ?? formSuccess}
        </div>
      )}

      <ol
        aria-label="Generation steps"
        className="flex items-center justify-between gap-2 rounded-full border border-aura-border bg-aura-void/70 px-3 py-2 text-[11px] uppercase tracking-[0.18em] backdrop-blur md:hidden"
      >
        {indicatorSteps.map((s, i) => {
          const active = i === indicatorActive;
          const done = i < indicatorActive;
          return (
            <li
              key={s.id}
              className="flex flex-1 items-center gap-2 first:justify-start last:justify-end"
            >
              <span
                aria-current={active ? "step" : undefined}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors ${
                  active
                    ? "border-aura-champagne bg-aura-champagne text-aura-void"
                    : done
                      ? "border-aura-champagne/60 bg-aura-champagne/15 text-aura-champagne"
                      : "border-aura-border text-aura-muted"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={
                  active
                    ? "text-aura-foreground"
                    : done
                      ? "text-aura-champagne/80"
                      : "text-aura-muted"
                }
              >
                {s.label}
              </span>
              {i < indicatorSteps.length - 1 && (
                <span
                  aria-hidden
                  className={`h-px flex-1 ${
                    done ? "bg-aura-champagne/40" : "bg-aura-border"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>

      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl text-aura-foreground">
              Your photo
            </h2>
            <p className="mt-1 text-sm text-aura-dim">
              Upload a clear photo of yourself — we preserve your identity across
              all 6 styled looks.
            </p>
          </div>

          <div
            {...getRootProps()}
            className={`cursor-pointer overflow-hidden rounded-2xl border border-dashed border-aura-border transition ${
              isDragActive ? "border-aura-champagne bg-aura-highlight/20" : ""
            }`}
          >
            <input {...getInputProps()} />
            {photoPreview ? (
              <div className="relative aspect-[3/4] max-h-80 w-full sm:mx-auto sm:max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="Your photo"
                  className="h-full w-full object-cover"
                />
                {uploadingPhoto && (
                  <div className="absolute inset-0 flex items-center justify-center bg-aura-void/60 text-sm text-aura-champagne">
                    Uploading…
                  </div>
                )}
              </div>
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center p-8 text-center">
                <p className="text-sm text-aura-muted">
                  <span className="hidden sm:inline">
                    Drop your photo here or click to browse
                  </span>
                  <span className="sm:hidden">Tap to choose from gallery</span>
                </p>
                <p className="mt-2 text-xs text-aura-dim">
                  Front-facing, good lighting works best
                </p>
              </div>
            )}
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCameraChange}
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-aura-border bg-aura-ink px-4 py-3 text-sm font-medium text-aura-foreground transition hover:border-aura-champagne/40 disabled:opacity-50 sm:hidden"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
              <circle cx="12" cy="13.5" r="3.5" />
            </svg>
            Take a photo
          </button>

          <button
            type="button"
            disabled={!userPhotoUrl || uploadingPhoto}
            onClick={() => setStep(1)}
            className="w-full rounded-xl bg-aura-champagne px-6 py-3 text-sm font-medium text-aura-void disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl text-aura-foreground">
              Style preferences
            </h2>
            <p className="mt-1 text-sm text-aura-dim">
              Tell us the vibe — we will generate 6 complete looks for you.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPath("online")}
              className={`rounded-2xl border p-4 text-left ${
                path === "online"
                  ? "border-aura-champagne bg-aura-highlight/30"
                  : "border-aura-border"
              }`}
            >
              <p className="font-medium text-aura-foreground">Shop online</p>
              <p className="mt-1 text-xs text-aura-dim">
                Fresh product discovery from the web.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setPath("wardrobe")}
              className={`rounded-2xl border p-4 text-left ${
                path === "wardrobe"
                  ? "border-aura-champagne bg-aura-highlight/30"
                  : "border-aura-border"
              }`}
            >
              <p className="font-medium text-aura-foreground">My wardrobe</p>
              <p className="mt-1 text-xs text-aura-dim">
                Style using pieces you already own.
              </p>
            </button>
          </div>

          {path === "wardrobe" && (
            <div className="rounded-xl border border-aura-border p-3">
              {wardrobeItems.length === 0 ? (
                <p className="text-xs text-aura-muted">
                  Add wardrobe items first, or switch to Shop online.
                </p>
              ) : (
                <>
                  <div
                    role="tablist"
                    aria-label="Wardrobe styling mode"
                    className="grid grid-cols-2 gap-2 rounded-lg border border-aura-border bg-aura-void/40 p-1"
                  >
                    {(
                      [
                        {
                          id: "mix",
                          label: "Mix only",
                          hint: "Six looks built from your closet.",
                        },
                        {
                          id: "pair",
                          label: "Pair with online",
                          hint: "Anchor pieces; we shop the rest.",
                        },
                      ] as const
                    ).map((m) => {
                      const active = wardrobeMode === m.id;
                      return (
                        <button
                          key={m.id}
                          role="tab"
                          aria-selected={active}
                          type="button"
                          onClick={() => setWardrobeMode(m.id)}
                          className={`rounded-md px-3 py-2 text-left transition ${
                            active
                              ? "bg-aura-highlight/40 text-aura-foreground shadow-inner"
                              : "text-aura-muted hover:text-aura-foreground"
                          }`}
                        >
                          <p className="text-xs font-medium">{m.label}</p>
                          <p className="mt-0.5 text-[10px] leading-4 text-aura-dim">
                            {m.hint}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px]">
                    <span className="uppercase tracking-[0.18em] text-aura-muted">
                      {wardrobeItemIds.length === 0
                        ? wardrobeMode === "pair"
                          ? "Pick at least one anchor piece"
                          : `Optional · ${wardrobeItems.length} item${wardrobeItems.length === 1 ? "" : "s"} available`
                        : `${wardrobeItemIds.length} selected`}
                    </span>
                    {wardrobeItemIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setWardrobeItemIds([])}
                        className="text-aura-muted underline-offset-2 hover:text-aura-foreground hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:max-h-80 sm:overflow-y-auto sm:pr-1">
                    {wardrobeItems.map((it) => {
                      const selected = wardrobeItemIds.includes(it.id);
                      const src = it.readUrl ?? it.imageUrl ?? null;
                      const label =
                        it.category.charAt(0).toUpperCase() +
                        it.category.slice(1).toLowerCase();
                      const isDeleting = deletingItemId === it.id;
                      return (
                        <div
                          key={it.id}
                          className={`group relative overflow-hidden rounded-lg border transition focus-within:ring-2 focus-within:ring-aura-champagne/40 ${
                            selected
                              ? "border-aura-champagne ring-2 ring-aura-champagne/50"
                              : "border-aura-border hover:border-aura-champagne/40"
                          } ${isDeleting ? "pointer-events-none opacity-50" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => toggleItem(it.id)}
                            aria-pressed={selected}
                            aria-label={selected ? `Deselect ${label}` : `Select ${label}`}
                            className="block w-full text-left focus:outline-none"
                          >
                            <div className="aspect-square bg-aura-highlight/10">
                              {src ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={src}
                                  alt={label}
                                  className={`h-full w-full object-cover transition ${
                                    selected ? "" : "opacity-90 group-hover:opacity-100"
                                  }`}
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center px-2 text-center text-[9px] uppercase tracking-widest text-aura-muted">
                                  {label}
                                </div>
                              )}
                            </div>
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-aura-void/85 via-aura-void/40 to-transparent px-1.5 pb-1 pt-3">
                              <p className="truncate text-[9px] uppercase tracking-[0.18em] text-aura-foreground/90">
                                {label}
                              </p>
                            </div>
                          </button>
                          {selected && (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute left-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-aura-champagne text-aura-void shadow-glow"
                            >
                              <svg
                                viewBox="0 0 12 12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-3 w-3"
                              >
                                <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                              </svg>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleDeleteWardrobeItem(it.id, label);
                            }}
                            disabled={isDeleting}
                            aria-label={`Delete ${label}`}
                            title="Remove from wardrobe"
                            className="absolute right-1.5 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-aura-border bg-aura-void/85 text-aura-muted backdrop-blur-sm transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-300/40 disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            {isDeleting ? (
                              <span
                                aria-hidden
                                className="h-3 w-3 animate-spin rounded-full border border-aura-muted border-t-transparent"
                              />
                            ) : (
                              <svg
                                aria-hidden
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4 sm:h-3 sm:w-3"
                              >
                                <path d="M3 4h10" />
                                <path d="M5.5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
                                <path d="M4.5 4l.5 8.5a1.5 1.5 0 0 0 1.5 1.4h3a1.5 1.5 0 0 0 1.5-1.4L11.5 4" />
                                <path d="M7 7v4" />
                                <path d="M9 7v4" />
                              </svg>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-aura-muted">Style type</label>
              <select
                value={styleType}
                onChange={(e) => setStyleType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm"
              >
                {STYLE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-aura-muted">Occasion</label>
              <input
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                className="mt-1 w-full rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm"
                placeholder="Daily outing, date, office…"
              />
            </div>
            <div>
              <label className="text-xs text-aura-muted">Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 w-full rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm"
                placeholder="Chennai, India"
              />
            </div>
            {!(path === "wardrobe" && wardrobeMode === "mix") && (
              <>
                <div>
                  <label className="text-xs text-aura-muted">
                    Budget min ₹
                  </label>
                  <input
                    type="number"
                    value={budgetMin}
                    onChange={(e) => setBudgetMin(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-aura-muted">
                    Budget max ₹
                  </label>
                  <input
                    type="number"
                    value={budgetMax}
                    onChange={(e) => setBudgetMax(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <label className="text-xs text-aura-muted">
              Optional preferences
            </label>
            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-aura-border bg-aura-ink px-3 py-2 text-sm"
              placeholder="Pinterest aesthetic, favorite colors, brands…"
            />
          </div>

          {(() => {
            // Surface a friendly reason just above the CTA whenever the
            // wardrobe path can't be generated yet, so the disabled button
            // isn't a mystery.
            const wardrobeBlocked =
              path === "wardrobe" &&
              (wardrobeItems.length === 0
                ? "Add wardrobe items first, or switch to Shop online."
                : wardrobeMode === "pair" && wardrobeItemIds.length === 0
                  ? "Pick at least one anchor piece for Pair mode."
                  : null);
            return wardrobeBlocked ? (
              <p className="rounded-xl border border-amber-300/20 bg-amber-200/5 px-4 py-3 text-xs text-amber-200/80">
                {wardrobeBlocked}
              </p>
            ) : null;
          })()}

          <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex items-center gap-3 border-t border-aura-border/60 bg-aura-void/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-0">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="rounded-xl border border-aura-border px-4 py-3 text-sm text-aura-muted hover:text-aura-foreground md:flex-1"
            >
              Back
            </button>
            <button
              type="button"
              disabled={
                path === "wardrobe" &&
                (wardrobeItems.length === 0 ||
                  (wardrobeMode === "pair" && wardrobeItemIds.length === 0))
              }
              onClick={async () => {
                try {
                  setFormError(null);
                  setFormSuccess(null);
                  setDoneJob(null);
                  await startGenerate();
                  setStep(2);
                } catch (e) {
                  showError(
                    e instanceof Error
                      ? e.message
                      : "Could not start generation"
                  );
                }
              }}
              className="flex-1 rounded-xl bg-aura-champagne py-3 text-sm font-medium text-aura-void disabled:cursor-not-allowed disabled:opacity-40"
            >
              Generate 6 looks
            </button>
          </div>
          <p className="text-center text-xs leading-5 text-aura-muted">
            A full board can take a few minutes because we verify real product
            links and render your image with product references. Keep this page
            open — we will show each step while it works.
          </p>
        </div>
      )}

      {step === 2 && jobId && (
        <div className="space-y-6">
          <GenerationProgress
            jobId={jobId}
            onComplete={(j) => {
              if (j.status === JobStatus.DONE || j.status === JobStatus.FAILED) {
                onJobComplete(j as JobShape);
              }
            }}
            onCancel={() => {
              setStep(0);
              setJobId(null);
              setDoneJob(null);
            }}
          />
          {doneJob?.status === JobStatus.FAILED && (
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setJobId(null);
                setDoneJob(null);
              }}
              className="text-xs text-aura-muted underline"
            >
              Back to preferences
            </button>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl text-aura-foreground">
              Pick your look
            </h2>
            <p className="mt-1 text-sm text-aura-dim">
              Tap a number to see the full breakdown and shop links. We keep
              enriching the catalog in the background, so more verified links
              can appear after the board is ready.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <LookSelector
              boardImageUrl={boardImageUrl}
              selectedLook={selectedLook}
              onSelectLook={setSelectedLook}
            />
            <div ref={detailPanelRef} className="scroll-mt-20">
              <LookDetailPanel
                look={selectedLook != null ? looks[selectedLook] ?? null : null}
                lookIndex={selectedLook}
                outfitId={savedOutfitId ?? doneJob?.result?.outfitId}
                onSave={selectedLook != null ? saveSnapshot : undefined}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={resetSession}
            className="text-xs text-aura-muted underline"
          >
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
