"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JobStatus } from "@prisma/client";

type Job = {
  status: JobStatus;
  progress: number;
  result: unknown;
  error: string | null;
};

const STAGES = [
  {
    at: 8,
    title: "Preparing the styling room",
    detail: "We are setting up your generation and reading the style brief.",
  },
  {
    at: 15,
    title: "Reading your reference photo",
    detail: "Face, pose, proportions and skin tone are analyzed so the final board keeps your identity consistent.",
  },
  {
    at: 28,
    title: "Building six outfit directions",
    detail: "The stylist model is choosing complete looks for your occasion, budget and location.",
  },
  {
    at: 42,
    title: "Verifying real products",
    detail: "We search live stores, open product pages, check images and keep only links that are actually usable.",
  },
  {
    at: 55,
    title: "Composing the visual board",
    detail: "Your photo and verified product images become references for the image model.",
  },
  {
    at: 65,
    title: "Rendering the six-panel image",
    detail: "This is the longest step. Please keep this tab open while the final board is generated.",
  },
  {
    at: 90,
    title: "Saving your results",
    detail: "We are storing the board and attaching shop links to each look.",
  },
];

function stageForProgress(progress: number) {
  return [...STAGES].reverse().find((stage) => progress >= stage.at) ?? STAGES[0]!;
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function GenerationProgress({
  jobId,
  onComplete,
  onProgress,
}: {
  jobId: string;
  onComplete: (job: Job) => void;
  onProgress?: (job: Job) => void;
}) {
  const [job, setJob] = useState<Job | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const notified = useRef(false);

  useEffect(() => {
    notified.current = false;
    setElapsed(0);
  }, [jobId]);

  useEffect(() => {
    const id = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/generate/status/${jobId}`);
        const j = (await r.json()) as Job;
        if (!cancelled) setJob(j);
      } catch {
        /* ignore */
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId]);

  useEffect(() => {
    if (!job) return;
    onProgress?.(job);
    if (
      (job.status === JobStatus.DONE || job.status === JobStatus.FAILED) &&
      !notified.current
    ) {
      notified.current = true;
      onComplete(job);
    }
  }, [job, onComplete, onProgress]);

  const pct = job?.progress ?? 5;
  const label = job?.status ?? "QUEUED";
  const currentStage = stageForProgress(pct);
  const activeStageIndex = STAGES.findIndex((stage) => stage.title === currentStage.title);
  const reassuringLine = useMemo(() => {
    if (job?.status === JobStatus.FAILED) {
      return "Something interrupted the run. Your inputs are safe — you can go back and try again.";
    }
    if (pct < 42) {
      return "This usually takes a little time because we are making the looks personal, not using fixed templates.";
    }
    if (pct < 65) {
      return "The product step is slower on purpose: we verify links before showing them so users do not get fake products.";
    }
    return "Image generation is the heavy part. Please wait here while the board finishes rendering.";
  }, [job?.status, pct]);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-aura-borderBright bg-[radial-gradient(circle_at_20%_0%,rgba(212,184,150,0.14),transparent_32%),linear-gradient(135deg,rgba(17,17,20,0.96),rgba(7,6,8,0.98))] p-5 shadow-glow sm:p-7">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-aura-champagne/60 to-transparent" />
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-aura-champagne/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-28 w-full bg-gradient-to-t from-aura-void/60 to-transparent" />

      <div className="relative grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] uppercase tracking-[0.38em] text-aura-muted">
              Live atelier
            </p>
            <p className="rounded-full border border-aura-border bg-aura-void/50 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-aura-champagne">
              {label} · {formatElapsed(elapsed)}
            </p>
          </div>

          <div className="mt-5">
            <p className="font-display text-3xl leading-tight text-aura-foreground sm:text-4xl">
              {currentStage.title}
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-aura-dim">
              {currentStage.detail}
            </p>
            <p className="mt-4 max-w-xl rounded-2xl border border-aura-border bg-aura-void/35 px-4 py-3 text-xs leading-5 text-aura-muted">
              {reassuringLine}
            </p>
          </div>

          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <p className="font-mono text-3xl text-aura-champagne">
                {Math.round(Math.min(100, Math.max(0, pct)))}%
              </p>
              <p className="text-right text-[11px] uppercase tracking-[0.22em] text-aura-muted">
                Please keep this page open
              </p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-aura-highlight">
              <div
                className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-aura-gold via-aura-champagne to-amber-100 transition-all duration-700 ease-out"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              >
                <div className="absolute inset-0 animate-shimmer bg-shimmer-gold bg-[length:220%_100%]" />
              </div>
            </div>
          </div>
        </div>

        <div className="relative min-h-64 overflow-hidden rounded-[1.5rem] border border-aura-border bg-aura-void/45 p-4 shadow-inner-highlight">
          <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="absolute left-0 top-1/3 h-px w-full animate-pulse-soft bg-gradient-to-r from-transparent via-aura-champagne/50 to-transparent" />
          <div className="relative flex h-full flex-col justify-between gap-5">
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] overflow-hidden rounded-xl border border-aura-border bg-aura-surface/80"
                >
                  <div
                    className="h-full w-full animate-pulse-soft bg-[radial-gradient(circle_at_50%_18%,rgba(212,184,150,0.30),transparent_13%),linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02)_45%,rgba(212,184,150,0.10))]"
                    style={{ animationDelay: `${i * 180}ms` }}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3">
              {STAGES.map((stage, i) => {
                const isDone = i < activeStageIndex;
                const isActive = i === activeStageIndex;
                return (
                  <div key={stage.title} className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full border ${
                        isActive
                          ? "animate-pulse bg-aura-champagne border-aura-champagne shadow-[0_0_18px_rgba(212,184,150,0.55)]"
                          : isDone
                            ? "border-aura-champagne/70 bg-aura-champagne/60"
                            : "border-aura-borderBright bg-aura-highlight"
                      }`}
                    />
                    <div>
                      <p
                        className={`text-xs ${
                          isActive
                            ? "text-aura-foreground"
                            : isDone
                              ? "text-aura-dim"
                              : "text-aura-muted"
                        }`}
                      >
                        {stage.title}
                      </p>
                      {isActive && (
                        <p className="mt-0.5 text-[11px] leading-4 text-aura-muted">
                          Working now
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {job?.error && (
        <p className="relative mt-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          {job.error}
        </p>
      )}
    </div>
  );
}
