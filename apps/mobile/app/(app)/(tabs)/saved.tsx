import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "../../../src/components/ui/Screen";
import { listSavedOutfits } from "../../../src/api/client";
import type { SavedOutfit } from "../../../src/api/types";

/** Extract the best image URL from a saved outfit — prefer generatedImages,
 *  fall back to snapshot.boardImageUrl, then snapshot.result.boardImageUrl. */
function thumbnailFor(o: SavedOutfit): string | null {
  const fromImages = o.generatedImages?.find((i) => i.cdnUrl)?.cdnUrl;
  if (fromImages) return fromImages;
  const snap = o.snapshot as
    | { boardImageUrl?: string; result?: { boardImageUrl?: string } }
    | null;
  return snap?.result?.boardImageUrl ?? snap?.boardImageUrl ?? null;
}

export default function SavedScreen() {
  const router = useRouter();
  const outfitsQuery = useQuery({
    queryKey: ["saved-outfits"],
    queryFn: listSavedOutfits,
  });

  const outfits = outfitsQuery.data ?? [];
  const loading = outfitsQuery.isLoading && !outfitsQuery.data;

  return (
    <Screen className="py-6">
      <Text className="text-[10px] uppercase tracking-[0.35em] text-muted">
        Library
      </Text>
      <Text className="mt-3 font-display text-3xl text-cream">Saved looks</Text>
      <Text className="mt-2 text-sm leading-6 text-dim">
        Boards you've kept for later. Tap to revisit the breakdown and shop links.
      </Text>

      <ScrollView
        className="mt-6 flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={outfitsQuery.isRefetching}
            onRefresh={() => outfitsQuery.refetch()}
            tintColor="#d4b896"
          />
        }
      >
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#d4b896" />
          </View>
        ) : outfits.length === 0 ? (
          <View className="mt-10 items-center rounded-2xl border border-dashed border-border bg-ink/40 px-6 py-12">
            <Text className="text-center text-sm text-dim">
              No saved looks yet. Tap "Save look" on any generated direction to
              keep it here.
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-3 pb-8">
            {outfits.map((o) => {
              const src = thumbnailFor(o);
              return (
                <Pressable
                  key={o.id}
                  onPress={() => router.push(`/(app)/saved/${o.id}`)}
                  className="overflow-hidden rounded-2xl border border-border bg-ink/40"
                  style={{ width: "48%" }}
                >
                  <View style={{ aspectRatio: 3 / 4 }} className="bg-stage">
                    {src ? (
                      <Image
                        source={{ uri: src }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="h-full w-full items-center justify-center px-3">
                        <Text className="text-center text-xs text-muted">
                          {o.occasion || "Saved outfit"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="p-3">
                    <Text
                      numberOfLines={1}
                      className="font-display text-sm text-cream"
                    >
                      {o.name || "Untitled look"}
                    </Text>
                    {o.occasion && (
                      <Text className="mt-0.5 text-[10px] text-dim">
                        {o.occasion}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
