import { useEffect, useRef, useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { useStyleSession } from "@/store/useStyleSession";
import {
  startGeneration,
  getGenerationStatus,
  cancelGeneration,
} from "@/api/client";
import { cacheGenerationJob } from "@/storage/localDb";

const STAGES = [
  { min: 0, label: "Reading your photo…" },
  { min: 15, label: "Planning six directions…" },
  { min: 42, label: "Curating shop links…" },
  { min: 72, label: "Finishing preview…" },
];

const MAX_POLL_MS = 5 * 60 * 1000; // 5 minutes max
const INITIAL_POLL_INTERVAL_MS = 1500;
const MAX_POLL_INTERVAL_MS = 5000;

function stageLabel(progress: number) {
  let label = STAGES[0]!.label;
  for (const s of STAGES) {
    if (progress >= s.min) label = s.label;
  }
  return label;
}

export default function GeneratingScreen() {
  const router = useRouter();
  const { preferences, remotePhotoUrl, setJobId, setResult, jobId } =
    useStyleSession();
  const [progress, setProgress] = useState(5);
  const [status, setStatus] = useState<string>("PROCESSING");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const abortRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulse = useSharedValue(0.4);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  // Pulse animation
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse]);

  // Cleanup on unmount — critical to stop background polling
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
        const { jobId: newJobId } = await startGeneration({
          path: preferences.path ?? "online",
          userPhotoUrl: remotePhotoUrl ?? undefined,
          styleType: preferences.styleType,
          occasion: preferences.occasion,
          location: preferences.location,
          budgetMin: preferences.budgetMin,
          budgetMax: preferences.budgetMax,
          style: preferences.style,
          previewOnly: true,
        });
        setJobId(newJobId);
        await cacheGenerationJob(newJobId, preferences);

        let interval = INITIAL_POLL_INTERVAL_MS;

        const poll = async () => {
          if (abortRef.current) return;

          // Hard timeout
          if (Date.now() - startedAt > MAX_POLL_MS) {
            if (!abortRef.current) {
              setError("Generation timed out. Please try again.");
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
              setError(job.error ?? "Generation failed. Please try again.");
              return;
            }

            // Grow interval up to cap (exponential backoff)
            interval = Math.min(Math.round(interval * 1.3), MAX_POLL_INTERVAL_MS);
          } catch {
            // Network hiccup — back off and retry
            interval = Math.min(interval * 2, MAX_POLL_INTERVAL_MS);
          }

          if (!abortRef.current) {
            timerRef.current = setTimeout(poll, interval);
          }
        };

        timerRef.current = setTimeout(poll, interval);
      } catch (e) {
        if (!abortRef.current) {
          setError(e instanceof Error ? e.message : "Could not start generation.");
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen className="items-center justify-center py-12">
      <Animated.View
        style={glowStyle}
        className="mb-10 h-40 w-40 rounded-full bg-champagne/20"
      />
      <Text className="text-[10px] uppercase tracking-[0.4em] text-champagne">
        Styling
      </Text>
      <Text className="mt-4 font-display text-2xl text-cream">
        {stageLabel(progress)}
      </Text>
      <View className="mt-8 h-1 w-full overflow-hidden rounded-full bg-border">
        <View
          className="h-full bg-champagne"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </View>
      <Text className="mt-3 font-mono text-xs text-muted">{status}</Text>
      {error && (
        <Text className="mt-4 text-center text-sm text-red-400">{error}</Text>
      )}
      {jobId && status === "PROCESSING" && (
        <Button
          label="Cancel"
          variant="ghost"
          className="mt-10 w-full"
          onPress={async () => {
            abortRef.current = true;
            if (timerRef.current) clearTimeout(timerRef.current);
            await cancelGeneration(jobId).catch(() => {});
            router.back();
          }}
        />
      )}
    </Screen>
  );
}
