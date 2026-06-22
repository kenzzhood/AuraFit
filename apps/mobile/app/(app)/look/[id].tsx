import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Linking,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "../../../src/components/ui/Screen";
import { Button } from "../../../src/components/ui/Button";
import { useStyleSession } from "../../../src/store/useStyleSession";
import {
  saveOutfit,
  patchOutfit,
  trackAffiliateClick,
  getGenerationStatus,
  type CartItemInput,
} from "../../../src/api/client";
import { useCartStore } from "../../../src/store/useCartStore";

const LOOK_POLL_MS = 5000;
const LOOK_POLL_MAX_MS = 10 * 60 * 1000;

function isShoppable(p: {
  productUrl?: string;
  source?: string;
  verified?: boolean;
  availability?: string;
  kind?: "online" | "wardrobe";
}) {
  if (p.kind === "wardrobe") return true;
  if (!p.productUrl) return false;
  if (p.source === "demo") return false;
  if (/example\.com/i.test(p.productUrl)) return false;
  if (p.verified !== true) return false;
  if (p.availability === "out_of_stock") return false;
  return true;
}

function productToCartInput(
  p: {
    kind?: "online" | "wardrobe";
    canonicalUrl?: string;
    productUrl?: string;
    productCacheId?: string;
    title?: string;
    imageUrl?: string;
    storeName?: string;
    source?: string;
    price?: number;
    currency?: string;
    matchCategory?: string;
    verified?: boolean;
    availability?: string;
  },
  opts: { outfitId?: string; outfitLabel?: string }
): CartItemInput | null {
  if (p.kind === "wardrobe") return null;
  const url = p.canonicalUrl ?? p.productUrl;
  if (!url || !isShoppable(p)) return null;
  return {
    productCacheId: p.productCacheId,
    outfitId: opts.outfitId,
    outfitLabel: opts.outfitLabel,
    title: p.title ?? "Product",
    imageUrl: p.imageUrl,
    productUrl: url,
    retailer: p.storeName ?? p.source,
    price: p.price,
    currency: p.currency,
    category: p.matchCategory,
  };
}

export default function LookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const index = Number(id);
  const router = useRouter();
  const { result, jobId, preferences, setResult } = useStyleSession();
  const addItem = useCartStore((s) => s.addItem);
  const addOutfit = useCartStore((s) => s.addOutfit);
  const look = result?.looks?.[index];
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pollStartedRef = useRef(Date.now());
  const abortRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshLinks = useCallback(async () => {
    if (!jobId) return;
    setRefreshing(true);
    try {
      const job = await getGenerationStatus(jobId);
      if (job.status === "DONE" && job.result) {
        setResult(job.result);
      }
    } catch (e) {
      Alert.alert(
        "Refresh failed",
        e instanceof Error ? e.message : "Could not refresh links."
      );
    } finally {
      setRefreshing(false);
    }
  }, [jobId, setResult]);

  useEffect(() => {
    if (!jobId) return;
    abortRef.current = false;
    pollStartedRef.current = Date.now();

    const poll = async () => {
      if (abortRef.current) return;
      if (Date.now() - pollStartedRef.current > LOOK_POLL_MAX_MS) return;

      try {
        const job = await getGenerationStatus(jobId);
        if (abortRef.current) return;
        if (job.status === "DONE" && job.result) {
          setResult(job.result);
          const currentLook = job.result.looks?.[index];
          const hasShoppable = (currentLook?.products ?? []).some(isShoppable);
          if (hasShoppable) return;
        }
      } catch {
        // ignore
      }

      if (!abortRef.current) {
        timerRef.current = setTimeout(poll, LOOK_POLL_MS);
      }
    };

    timerRef.current = setTimeout(poll, LOOK_POLL_MS);
    return () => {
      abortRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [jobId, index, setResult]);

  if (!look) {
    return (
      <Screen className="justify-center">
        <Text className="text-cream">Look not found</Text>
      </Screen>
    );
  }

  const openShop = async (url?: string, productCacheId?: string) => {
    if (!url) return;
    try {
      const { redirectUrl } = await trackAffiliateClick({
        targetUrl: url,
        source: "mobile_look_detail",
        outfitId: result?.outfitId,
        productCacheId,
      });
      await Linking.openURL(redirectUrl);
    } catch {
      await Linking.openURL(url);
    }
  };

  const boardImageUrl = result?.boardImageUrl ?? null;
  const shoppable = (look.products ?? []).filter(isShoppable);
  const productFailure = result?.providerMeta?.failures?.find(
    (f) => f.system === "products"
  );

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const snap = {
        lookIndex: index,
        path: preferences.path,
        styleType: preferences.styleType,
        occasion: preferences.occasion,
        location: preferences.location,
        budgetMin: preferences.budgetMin,
        budgetMax: preferences.budgetMax,
        style: preferences.style,
        boardImageUrl: result?.boardImageUrl,
        looks: result?.looks,
        jobId,
      };
      const name = look.label ?? `Look ${index + 1}`;

      if (result?.outfitId) {
        await patchOutfit(result.outfitId, {
          name,
          occasion: preferences.occasion,
          isSaved: true,
          snapshot: snap,
        });
      } else {
        await saveOutfit({
          name,
          occasion: preferences.occasion,
          snapshot: snap,
        });
      }
      setSaved(true);
      Alert.alert("Saved", "Added to your library.");
    } catch (e) {
      Alert.alert(
        "Save failed",
        e instanceof Error ? e.message : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen className="py-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-[10px] uppercase tracking-widest text-muted">
          Look {index + 1}
        </Text>
        <Text className="mt-2 font-display text-3xl text-cream">{look.label}</Text>
        {look.tagline && (
          <Text className="mt-2 text-champagne">{look.tagline}</Text>
        )}

        {boardImageUrl && (
          <View className="mt-5 overflow-hidden rounded-2xl border border-border bg-ink/40">
            <Image
              source={{ uri: boardImageUrl }}
              className="w-full"
              style={{ aspectRatio: 4 / 5 }}
              resizeMode="contain"
            />
            <View className="absolute left-3 top-3 rounded-full bg-void/80 px-3 py-1">
              <Text className="text-[10px] uppercase tracking-[0.3em] text-champagne">
                Look {index + 1} of {result?.looks?.length ?? 6}
              </Text>
            </View>
          </View>
        )}

        {look.description && (
          <Text className="mt-5 text-sm leading-6 text-dim">{look.description}</Text>
        )}

        {(look.bestFor || look.priceRange) && (
          <View className="mt-4 flex-row flex-wrap gap-2">
            {look.bestFor && (
              <View className="rounded-full border border-border px-3 py-1">
                <Text className="text-[10px] uppercase tracking-widest text-dim">
                  {look.bestFor}
                </Text>
              </View>
            )}
            {look.priceRange && (
              <View className="rounded-full border border-border px-3 py-1">
                <Text className="text-[10px] uppercase tracking-widest text-champagne">
                  {look.priceRange}
                </Text>
              </View>
            )}
          </View>
        )}

        {look.items && look.items.length > 0 && (
          <View className="mt-8">
            <Text className="text-xs uppercase tracking-widest text-muted">
              Outfit breakdown
            </Text>
            {look.items.map((item, i) => {
              const matched = (look.products ?? []).find(
                (p) =>
                  p.matchCategory?.toLowerCase() === item.category.toLowerCase()
              );
              return (
                <View
                  key={i}
                  className="mt-3 rounded-xl border border-border bg-ink/40 p-3"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[10px] uppercase text-muted">
                      {item.category}
                    </Text>
                    {matched?.kind === "wardrobe" ? (
                      <Text className="text-[9px] uppercase tracking-widest text-champagne">
                        From wardrobe
                      </Text>
                    ) : matched?.verified ? (
                      <Text className="text-[9px] uppercase tracking-widest text-emerald-400">
                        Verified
                      </Text>
                    ) : matched ? (
                      <Text className="text-[9px] uppercase tracking-widest text-muted">
                        Verifying…
                      </Text>
                    ) : null}
                  </View>
                  <Text className="mt-1 text-sm text-cream">{item.description}</Text>
                </View>
              );
            })}
          </View>
        )}

        {productFailure && (
          <View className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <Text className="text-xs leading-5 text-amber-200/90">
              {productFailure.message}
            </Text>
          </View>
        )}

        <View className="mt-8">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs uppercase tracking-widest text-muted">
              Shop this look
            </Text>
            {jobId && (
              <Pressable onPress={refreshLinks} disabled={refreshing}>
                <Text className="text-xs text-champagne underline">
                  {refreshing ? "Refreshing…" : "Refresh links"}
                </Text>
              </Pressable>
            )}
          </View>
          {shoppable.length === 0 ? (
            <View className="mt-3">
              {refreshing && (
                <ActivityIndicator color="#d4b896" className="mb-2" />
              )}
              <Text className="text-sm italic text-muted">
                {(look.products ?? []).length
                  ? "Verifying product links… tap Refresh links in a moment."
                  : preferences.path === "wardrobe" && preferences.wardrobeMode === "mix"
                    ? "This look uses your wardrobe pieces only — no online shop links."
                    : "Finding verified products that match this look…"}
              </Text>
            </View>
          ) : (
            shoppable.map((p, i) => (
              <View
                key={i}
                className="mt-3 flex-row gap-3 rounded-xl border border-border p-3"
              >
                <Pressable
                  onPress={() =>
                    p.kind === "wardrobe"
                      ? undefined
                      : openShop(p.canonicalUrl ?? p.productUrl, p.productCacheId)
                  }
                  className="flex-1 flex-row gap-3"
                >
                  {p.imageUrl ? (
                    <Image
                      source={{ uri: p.imageUrl }}
                      className="h-14 w-14 rounded-lg"
                    />
                  ) : (
                    <View className="h-14 w-14 rounded-lg bg-stage" />
                  )}
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[10px] uppercase tracking-widest text-muted">
                        {p.matchCategory ?? "Garment"}
                      </Text>
                      {p.kind === "wardrobe" ? (
                        <Text className="text-[9px] uppercase tracking-widest text-champagne">
                          From wardrobe
                        </Text>
                      ) : (
                        <Text className="text-[9px] uppercase tracking-widest text-emerald-400">
                          Verified
                        </Text>
                      )}
                    </View>
                    <Text
                      className="text-sm font-medium text-cream"
                      numberOfLines={2}
                    >
                      {p.title}
                    </Text>
                    {p.storeName && (
                      <Text className="text-[10px] text-muted">{p.storeName}</Text>
                    )}
                    {p.price != null && (
                      <Text className="mt-1 text-xs text-champagne">
                        ₹{p.price.toLocaleString("en-IN")}
                      </Text>
                    )}
                    {p.kind !== "wardrobe" && (
                      <Text className="mt-2 text-xs font-medium text-champagne underline">
                        Shop →
                      </Text>
                    )}
                  </View>
                </Pressable>
                {p.kind !== "wardrobe" && (
                  <Pressable
                    onPress={() => {
                      const input = productToCartInput(p, {
                        outfitId: result?.outfitId,
                        outfitLabel: look.label ?? `Look ${index + 1}`,
                      });
                      if (input) void addItem(input);
                    }}
                    className="justify-center px-2"
                  >
                    <Text className="text-[10px] text-champagne">+ Cart</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View className="mt-4 gap-3">
        {(look.products ?? []).some(
          (p) => p.kind !== "wardrobe" && isShoppable(p)
        ) && (
          <Button
            label="Add look to cart"
            variant="ghost"
            onPress={() => {
              const label = look.label ?? `Look ${index + 1}`;
              const inputs = (look.products ?? [])
                .map((p) =>
                  productToCartInput(p, {
                    outfitId: result?.outfitId,
                    outfitLabel: label,
                  })
                )
                .filter((x): x is CartItemInput => !!x);
              if (inputs.length > 0) {
                void addOutfit(result?.outfitId, label, inputs);
              }
            }}
          />
        )}
        <Button
          label="Refine with stylist"
          variant="ghost"
          onPress={() => router.push("/(app)/refine")}
        />
        <Button
          label={saved ? "Saved" : saving ? "Saving…" : "Save this look"}
          loading={saving}
          disabled={saved || saving}
          onPress={handleSave}
        />
      </View>
    </Screen>
  );
}
