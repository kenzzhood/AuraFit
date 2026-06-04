import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Screen } from "../../src/components/ui/Screen";
import { Button } from "../../src/components/ui/Button";
import { useStyleSession } from "../../src/store/useStyleSession";
import {
  startGeneration,
  getGenerationStatus,
  cancelGeneration,
  AuthRequiredError,
} from "../../src/api/client";
import { cacheGenerationJob } from "../../src/storage/localDb";
import { checkForUpdatesOnLaunch } from "../../src/updates/checkForUpdates";

/** Stage thresholds mirror the web (`src/components/generate/GenerationProgress.tsx`).
 *  Copy is trimmed to one short sentence per stage to fit phone screens. */
const STAGES = [
  {
    at: 8,
    title: "Preparing the styling room",
    detail: "Setting up your generation and reading the brief.",
  },
  {
    at: 15,
    title: "Reading your reference photo",
    detail: "Face, pose and tone — so the board keeps your identity.",
  },
  {
    at: 28,
    title: "Building six outfit directions",
    detail: "Choosing complete looks for your occasion and budget.",
  },
  {
    at: 42,
    title: "Verifying real products",
    detail: "Opening live stores and keeping only links that work.",
  },
  {
    at: 55,
    title: "Composing the visual board",
    detail: "Your photo and verified products become references.",
  },
  {
    at: 65,
    title: "Rendering the six-panel image",
    detail: "The longest step. Keep this screen open while it finishes.",
  },
  {
    at: 90,
    title: "Saving your results",
    detail: "Storing the board and attaching shop links to each look.",
  },
] as const;

const MAX_POLL_MINUTES = 10;
const MAX_POLL_MS = MAX_POLL_MINUTES * 60 * 1000; // multi-store crawl + cold start on Azure
const POLL_INTERVAL_MS = 1500; // flat 1.5s, matches web
const LONG_RUN_HINT_MS = 90 * 1000; // show extra reassurance past 90s
const COLD_START_HINT_MS = 25 * 1000; // Azure scale-from-zero wake-up

function stageForProgress(progress: number) {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (progress >= STAGES[i]!.at) return { stage: STAGES[i]!, index: i };
  }
  return { stage: STAGES[0]!, index: 0 };
}

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

// ── Placeholder tile (staggered pulse) ────────────────────────────────────
function PlaceholderTile({ index }: { index: number }) {
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withDelay(
      index * 180,
      withRepeat(
        withTiming(0.7, {
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true
      )
    );
  }, [index, pulse]);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View
      style={{ aspectRatio: 3 / 4 }}
      className="flex-1 overflow-hidden rounded-xl border border-border bg-surface/80"
    >
      <Animated.View
        style={style}
        className="h-full w-full bg-champagne/15"
      />
    </View>
  );
}

// ── Progress bar with shimmer ─────────────────────────────────────────────
function ProgressBar({ pct }: { pct: number }) {
  const width = useSharedValue(0);
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    width.value = withTiming(Math.min(100, Math.max(0, pct)), {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, width]);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.linear }),
      -1,
      false
    );
  }, [shimmer]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * 280 - 140 }],
  }));

  return (
    <View className="mt-3 h-2 overflow-hidden rounded-full bg-highlight">
      <Animated.View
        style={barStyle}
        className="relative h-full overflow-hidden rounded-full bg-champagne"
      >
        <Animated.View
          style={shimmerStyle}
          className="absolute inset-y-0 w-1/3 bg-cream/40"
        />
      </Animated.View>
    </View>
  );
}

export default function GeneratingScreen() {
  const router = useRouter();
  const { preferences, remotePhotoUrl, setJobId, setResult, jobId, reset } =
    useStyleSession();
  const [progress, setProgress] = useState(5);
  const [status, setStatus] = useState<string>("QUEUED");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const started = useRef(false);
  const abortRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Elapsed seconds counter
  useEffect(() => {
    elapsedRef.current = setInterval(
      () => setElapsed((v) => v + 1),
      1000
    );
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Generation flow
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const startedAt = Date.now();

    (async () => {
      try {
        // Pull latest bundle before a long generation run (preview/production).
        await checkForUpdatesOnLaunch();

        const path = preferences.path ?? "online";
        const wardrobeMode = preferences.wardrobeMode ?? "mix";
        const hideBudget = path === "wardrobe" && wardrobeMode === "mix";

        const { jobId: newJobId } = await startGeneration({
          path,
          userPhotoUrl: remotePhotoUrl ?? undefined,
          styleType: preferences.styleType,
          occasion: preferences.occasion,
          location: preferences.location,
          budgetMin: hideBudget ? undefined : preferences.budgetMin,
          budgetMax: hideBudget ? undefined : preferences.budgetMax,
          style: preferences.style,
          wardrobeItemIds:
            path === "wardrobe" && (preferences.wardrobeItemIds?.length ?? 0) > 0
              ? preferences.wardrobeItemIds
              : undefined,
          wardrobeMode: path === "wardrobe" ? wardrobeMode : undefined,
          renderQuality: preferences.renderQuality ?? "medium",
        });
        setJobId(newJobId);
        await cacheGenerationJob(newJobId, preferences);

        const poll = async () => {
          if (abortRef.current) return;

          if (Date.now() - startedAt > MAX_POLL_MS) {
            if (!abortRef.current) {
              await cancelGeneration(newJobId).catch(() => {});
              setError(
                `Generation timed out after ${MAX_POLL_MINUTES} minutes. Please try again — if the issue persists, check your connection.`
              );
              setStatus("FAILED");
            }
            return;
          }

          try {
            const job = await getGenerationStatus(newJobId);
            if (abortRef.current) return;

            setProgress(job.progress);
            setStatus(job.status);

            if (job.status === "DONE" && job.result) {
              setResult(job.result);
              await cacheGenerationJob(newJobId, preferences, job.result);
              router.replace("/(app)/results");
              return;
            }

            if (job.status === "FAILED") {
              setError(
                job.error ??
                  "Something interrupted the run. Your inputs are safe."
              );
              return;
            }
          } catch {
            // Network hiccup — swallow and retry on next tick
          }

          if (!abortRef.current) {
            timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          }
        };

        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (e) {
        if (!abortRef.current) {
          if (e instanceof AuthRequiredError) {
            // Session expired — send user back to sign-in rather than
            // showing a cryptic "Request failed (404)" message.
            router.replace("/(auth)/sign-in");
            return;
          }
          setError(
            e instanceof Error ? e.message : "Could not start generation."
          );
          setStatus("FAILED");
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFailed = status === "FAILED" || !!error;
  const { stage: currentStage, index: activeStageIndex } = useMemo(
    () => stageForProgress(progress),
    [progress]
  );

  const reassuringLine = useMemo(() => {
    if (isFailed) {
      return "Something interrupted the run. Your inputs are safe — go back and try again.";
    }
    if (progress < 42) {
      return "This takes a moment because we make the looks personal — no templates.";
    }
    if (progress < 65) {
      return "The product step is slower on purpose: we verify links so you don't get fakes.";
    }
    return "Image generation is the heavy part. Hang tight while the board renders.";
  }, [isFailed, progress]);

  const longRunHint =
    !isFailed && status === "PROCESSING" && elapsed * 1000 > LONG_RUN_HINT_MS;

  const coldStartHint =
    !isFailed &&
    (status === "QUEUED" || status === "PROCESSING") &&
    progress < 15 &&
    elapsed * 1000 > COLD_START_HINT_MS;

  const backToPreferences = () => {
    abortRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setJobId(null);
    setResult(null);
    router.replace("/(app)/style");
  };

  return (
    <Screen className="py-6">
      <ScrollView
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Header pill */}
        <View className="flex-row items-center justify-between">
          <Text className="text-[10px] uppercase tracking-[0.38em] text-muted">
            Live atelier
          </Text>
          <View className="rounded-full border border-border bg-stage/60 px-3 py-1">
            <Text className="font-mono text-[10px] uppercase tracking-[0.18em] text-champagne">
              {status} · {formatElapsed(elapsed)}
            </Text>
          </View>
        </View>

        {/* Current stage title + detail */}
        <Text
          className={`mt-5 font-display text-3xl leading-tight ${
            isFailed ? "text-dim" : "text-cream"
          }`}
        >
          {isFailed ? "Run interrupted" : currentStage.title}
        </Text>
        <Text className="mt-2 text-sm leading-5 text-dim">
          {isFailed
            ? "Your photo and preferences are still here — try again whenever you're ready."
            : currentStage.detail}
        </Text>

        {/* Reassurance line */}
        <View className="mt-4 rounded-2xl border border-border bg-stage/60 px-4 py-3">
          <Text className="text-xs leading-5 text-muted">{reassuringLine}</Text>
        </View>

        {/* Percentage + progress bar */}
        <View className="mt-6">
          <View className="flex-row items-end justify-between">
            <Text
              className={`font-mono text-3xl ${
                isFailed ? "text-dim" : "text-champagne"
              }`}
            >
              {Math.round(Math.min(100, Math.max(0, progress)))}%
            </Text>
            <Text className="text-right text-[10px] uppercase tracking-[0.22em] text-muted">
              Keep this screen open
            </Text>
          </View>
          <ProgressBar pct={isFailed ? Math.min(progress, 100) : progress} />
        </View>

        {/* Placeholder board grid */}
        <View className="mt-6 rounded-2xl border border-border bg-stage/40 p-3">
          <View className="flex-row gap-2">
            <PlaceholderTile index={0} />
            <PlaceholderTile index={1} />
            <PlaceholderTile index={2} />
          </View>
          <View className="mt-2 flex-row gap-2">
            <PlaceholderTile index={3} />
            <PlaceholderTile index={4} />
            <PlaceholderTile index={5} />
          </View>
        </View>

        {/* Vertical stage list */}
        <View className="mt-6">
          {STAGES.map((stage, i) => {
            const isDone = !isFailed && i < activeStageIndex;
            const isActive = !isFailed && i === activeStageIndex;
            return (
              <View
                key={stage.title}
                className="flex-row items-start gap-3 py-2"
              >
                <View
                  className={`mt-1 h-2.5 w-2.5 rounded-full border ${
                    isActive
                      ? "border-champagne bg-champagne"
                      : isDone
                        ? "border-champagne/70 bg-champagne/60"
                        : "border-borderBright bg-highlight"
                  }`}
                />
                <View className="flex-1">
                  <Text
                    className={`text-xs ${
                      isActive
                        ? "text-cream"
                        : isDone
                          ? "text-dim"
                          : "text-muted"
                    }`}
                  >
                    {stage.title}
                  </Text>
                  {isActive && (
                    <Text className="mt-0.5 text-[10px] leading-4 text-muted">
                      Working now
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Cold-start hint (Azure scale-from-zero) */}
        {coldStartHint && (
          <View className="mt-4 rounded-2xl border border-border bg-stage/40 px-4 py-3">
            <Text className="text-xs leading-5 text-dim">
              Waking the server — first run after idle can take up to a minute.
            </Text>
          </View>
        )}

        {/* Long-run hint */}
        {longRunHint && (
          <View className="mt-4 rounded-2xl border border-champagne/30 bg-champagne/5 px-4 py-3">
            <Text className="text-xs leading-5 text-champagne">
              Still working — rendering is the slowest step, almost there.
            </Text>
          </View>
        )}

        {/* Error panel */}
        {error && (
          <View className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3">
            <Text className="text-xs leading-5 text-red-300">{error}</Text>
          </View>
        )}
      </ScrollView>

      {/* Action row */}
      <View className="mt-3 gap-3">
        {isFailed ? (
          <>
            <Button label="Back to preferences" onPress={backToPreferences} />
            <Button
              label="Start over"
              variant="ghost"
              onPress={() => {
                reset();
                router.replace("/(app)/(tabs)");
              }}
            />
          </>
        ) : (
          jobId &&
          (status === "PROCESSING" || status === "QUEUED") && (
            <Button
              label="Cancel"
              variant="ghost"
              onPress={async () => {
                abortRef.current = true;
                if (timerRef.current) clearTimeout(timerRef.current);
                await cancelGeneration(jobId).catch(() => {});
                router.back();
              }}
            />
          )
        )}
      </View>
    </Screen>
  );
}
