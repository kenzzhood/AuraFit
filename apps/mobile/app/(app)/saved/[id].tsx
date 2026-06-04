import {
  View,
  Text,
  ScrollView,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../../src/components/ui/Screen";
import { Button } from "../../../src/components/ui/Button";
import {
  getSavedOutfit,
  deleteSavedOutfit,
  trackAffiliateClick,
} from "../../../src/api/client";
import type { GenerationLook, LookProduct } from "../../../src/api/types";

type SnapshotShape = {
  boardImageUrl?: string | null;
  result?: { boardImageUrl?: string | null; looks?: GenerationLook[] } | null;
  look?: GenerationLook | null;
  index?: number;
  looks?: GenerationLook[];
};

export default function SavedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const outfitQuery = useQuery({
    queryKey: ["saved-outfit", id],
    queryFn: () => getSavedOutfit(id!),
    enabled: !!id,
  });

  const removeMutation = useMutation({
    mutationFn: deleteSavedOutfit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-outfits"] });
      router.back();
    },
  });

  if (outfitQuery.isLoading) {
    return (
      <Screen className="items-center justify-center">
        <ActivityIndicator color="#d4b896" />
      </Screen>
    );
  }

  if (!outfitQuery.data) {
    return (
      <Screen className="items-center justify-center">
        <Text className="text-cream">Look not found</Text>
      </Screen>
    );
  }

  const outfit = outfitQuery.data;
  const snap = (outfit.snapshot ?? {}) as SnapshotShape;
  const look = snap.look ?? snap.result?.looks?.[snap.index ?? 0] ?? null;
  const boardImageUrl =
    snap.result?.boardImageUrl ?? snap.boardImageUrl ?? null;
  const items = look?.items ?? [];
  const shoppable = (look?.products ?? []).filter(
    (p) =>
      p.productUrl &&
      p.source !== "demo" &&
      !/example\.com/i.test(p.productUrl) &&
      p.verified === true &&
      p.availability !== "out_of_stock"
  );

  const openShop = async (p: LookProduct) => {
    const target = p.canonicalUrl ?? p.productUrl;
    if (!target) return;
    try {
      const { redirectUrl } = await trackAffiliateClick({
        targetUrl: target,
        source: "mobile_saved_detail",
        outfitId: outfit.id,
        productCacheId: p.productCacheId,
      });
      await Linking.openURL(redirectUrl);
    } catch {
      await Linking.openURL(target);
    }
  };

  const confirmDelete = () => {
    Alert.alert("Delete saved look?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => removeMutation.mutate(outfit.id),
      },
    ]);
  };

  return (
    <Screen className="py-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text className="text-[10px] uppercase tracking-[0.35em] text-muted">
            ← Saved
          </Text>
        </Pressable>
        <Text className="mt-3 font-display text-3xl text-cream">
          {outfit.name || "Untitled look"}
        </Text>
        {outfit.occasion && (
          <Text className="mt-1 text-sm text-champagne">{outfit.occasion}</Text>
        )}
        {look?.tagline && (
          <Text className="mt-2 text-sm text-dim">{look.tagline}</Text>
        )}

        {boardImageUrl && (
          <View className="mt-5 overflow-hidden rounded-2xl border border-border bg-ink/40">
            <Image
              source={{ uri: boardImageUrl }}
              className="w-full"
              style={{ aspectRatio: 4 / 5 }}
              resizeMode="contain"
            />
          </View>
        )}

        {look?.description && (
          <Text className="mt-5 text-sm leading-6 text-dim">
            {look.description}
          </Text>
        )}

        {items.length > 0 && (
          <View className="mt-8">
            <Text className="text-xs uppercase tracking-widest text-muted">
              Breakdown
            </Text>
            {items.map((item, i) => (
              <View
                key={i}
                className="mt-3 rounded-xl border border-border bg-ink/40 p-3"
              >
                <Text className="text-[10px] uppercase text-muted">
                  {item.category}
                </Text>
                <Text className="mt-1 text-sm text-cream">
                  {item.description}
                </Text>
              </View>
            ))}
          </View>
        )}

        {shoppable.length > 0 && (
          <View className="mt-8">
            <Text className="text-xs uppercase tracking-widest text-muted">
              Shop this look
            </Text>
            {shoppable.map((p, i) => (
              <Pressable
                key={i}
                onPress={() => openShop(p)}
                className="mt-3 flex-row gap-3 rounded-xl border border-border p-3"
              >
                {p.imageUrl && (
                  <Image
                    source={{ uri: p.imageUrl }}
                    className="h-14 w-14 rounded-lg"
                  />
                )}
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[10px] uppercase tracking-widest text-muted">
                      {p.matchCategory ?? "Garment"}
                    </Text>
                    <Text className="text-[9px] uppercase tracking-widest text-emerald-400">
                      Verified
                    </Text>
                  </View>
                  <Text
                    numberOfLines={2}
                    className="text-sm font-medium text-cream"
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
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Button
        label="Delete saved look"
        variant="ghost"
        className="mt-4"
        onPress={confirmDelete}
        loading={removeMutation.isPending}
      />
    </Screen>
  );
}
