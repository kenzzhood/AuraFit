import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../src/components/ui/Screen";
import { useStyleSession } from "../../src/store/useStyleSession";
import { getGenerationStatus } from "../../src/api/client";
import type { GenerationLook } from "../../src/api/types";
import { cn } from "../../src/lib/cn";

const REFRESH_POLL_MS = 5000;
const REFRESH_MAX_MS = 10 * 60 * 1000;
const LONG_WAIT_MS = 3 * 60 * 1000;

function countVerifiedProducts(looks: GenerationLook[] | undefined) {
  if (!looks) return 0;
  return looks.reduce((sum, look) => {
    const verified = (look.products ?? []).filter(
      (p) =>
        p.verified === true &&
        p.productUrl &&
        p.source !== "demo" &&
        !/example\.com/i.test(p.productUrl) &&
        p.availability !== "out_of_stock"
    );
    return sum + verified.length;
  }, 0);
}

function looksNeedMoreLinks(looks: GenerationLook[]) {
  if (!looks.length) return true;
  return looks.some((look) => {
    const shoppable = (look.products ?? []).filter(
      (p) =>
        p.verified === true &&
        p.productUrl &&
        p.source !== "demo" &&
        !/example\.com/i.test(p.productUrl) &&
        p.availability !== "out_of_stock"
    );
    return shoppable.length === 0;
  });
}

export default function ResultsScreen() {
  const router = useRouter();
  const { result, setResult, setSelectedLook, selectedLookIndex, jobId } =
    useStyleSession();
  const looks = result?.looks ?? [];
  const boardImageUrl = result?.boardImageUrl ?? null;
  const startedAtRef = useRef(Date.now());
  const abortRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!jobId) return;

    abortRef.current = false;
    startedAtRef.current = Date.now();
    setElapsedMs(0);

    const poll = async () => {
      if (abortRef.current) return;
      const elapsed = Date.now() - startedAtRef.current;
      if (elapsed > REFRESH_MAX_MS) return;

      try {
        const job = await getGenerationStatus(jobId);
        if (abortRef.current) return;
        if (job.status === "DONE" && job.result) {
          setResult(job.result);
          const updatedLooks = job.result.looks ?? [];
          if (!looksNeedMoreLinks(updatedLooks)) {
            return;
          }
        }
      } catch {
        // ignore transient network errors
      }

      if (!abortRef.current) {
        timerRef.current = setTimeout(poll, REFRESH_POLL_MS);
      }
    };

    timerRef.current = setTimeout(poll, REFRESH_POLL_MS);

    return () => {
      abortRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId, setResult]);

  const verifiedCount = countVerifiedProducts(looks);
  const productFailure = result?.providerMeta?.failures?.find(
    (f) => f.system === "products"
  );
  const stillVerifying = verifiedCount === 0 && looks.length > 0;

  const openLook = (i: number) => {
    setSelectedLook(i);
    router.push(`/(app)/look/${i}`);
  };

  return (
    <Screen className="py-6">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <Text className="text-[10px] uppercase tracking-[0.35em] text-muted">
          Your looks
        </Text>
        <Text className="mt-3 font-display text-3xl text-cream">
          Pick a direction
        </Text>
        <Text className="mt-2 text-sm leading-5 text-dim">
          Tap a number to see the full breakdown and shop links. We keep enriching
          the catalog in the background, so more verified links can appear after
          the board is ready.
        </Text>

        {productFailure && (
          <View className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <Text className="text-xs leading-5 text-amber-200/90">
              {productFailure.message}
            </Text>
          </View>
        )}

        {stillVerifying && elapsedMs > LONG_WAIT_MS && (
          <View className="mt-4 rounded-2xl border border-border bg-stage/60 px-4 py-3">
            <Text className="text-xs leading-5 text-dim">
              Links are taking longer than usual — the crawler is still checking
              stores. Stay on this screen or open a look and tap Refresh links.
            </Text>
          </View>
        )}

        <View className="mt-6 overflow-hidden rounded-2xl border border-border bg-ink/40">
          <View className="border-b border-border px-4 py-3">
            <Text className="text-[10px] uppercase tracking-[0.3em] text-muted">
              Your six-look fashion board
            </Text>
          </View>
          {boardImageUrl ? (
            <Image
              source={{ uri: boardImageUrl }}
              className="w-full"
              style={{ aspectRatio: 4 / 5 }}
              resizeMode="contain"
            />
          ) : (
            <View
              className="w-full items-center justify-center bg-ink/60 px-6"
              style={{ aspectRatio: 4 / 5 }}
            >
              <ActivityIndicator color="#d4b896" />
              <Text className="mt-3 text-center text-xs text-muted">
                Fashion board image pending — your six looks below are still ready
                to explore.
              </Text>
            </View>
          )}
          <View className="flex-row flex-wrap justify-center gap-3 px-4 py-4">
            {looks.map((_, i) => {
              const active = selectedLookIndex === i;
              return (
                <Pressable
                  key={i}
                  onPress={() => openLook(i)}
                  className={cn(
                    "h-10 w-10 items-center justify-center rounded-full border-2",
                    active
                      ? "border-champagne bg-champagne"
                      : "border-champagne/60 bg-void"
                  )}
                >
                  <Text
                    className={cn(
                      "font-semibold",
                      active ? "text-void" : "text-champagne"
                    )}
                  >
                    {i + 1}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {stillVerifying ? (
          <View className="mt-4 flex-row items-center justify-center gap-2">
            <ActivityIndicator color="#d4b896" size="small" />
            <Text className="text-center text-xs text-dim">
              Verifying product links…
            </Text>
          </View>
        ) : verifiedCount > 0 ? (
          <Text className="mt-4 text-center text-xs text-dim">
            {verifiedCount} verified shop link{verifiedCount === 1 ? "" : "s"}{" "}
            ready
          </Text>
        ) : null}

        <View className="mt-8 gap-4 pb-8">
          {looks.map((look, i) => (
            <Pressable
              key={i}
              onPress={() => openLook(i)}
              className="overflow-hidden rounded-2xl border border-border bg-ink/50"
            >
              <View className="flex-row items-start gap-4 p-4">
                <View className="h-10 w-10 items-center justify-center rounded-full border border-champagne/50">
                  <Text className="font-semibold text-champagne">{i + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-display text-lg text-cream">
                    {look.label}
                  </Text>
                  {look.tagline && (
                    <Text className="mt-1 text-sm text-champagne/90">
                      {look.tagline}
                    </Text>
                  )}
                  {look.description && (
                    <Text className="mt-2 text-xs leading-5 text-dim" numberOfLines={2}>
                      {look.description}
                    </Text>
                  )}
                  <Text className="mt-2 text-[10px] uppercase tracking-widest text-muted">
                    {(look.products ?? []).filter((p) => p.verified).length}{" "}
                    verified product
                    {(look.products ?? []).filter((p) => p.verified).length === 1
                      ? ""
                      : "s"}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
