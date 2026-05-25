import { View, Text, ScrollView, Pressable, Image, Linking, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { useStyleSession } from "@/store/useStyleSession";
import {
  saveOutfit,
  trackAffiliateClick,
  requestHdRender,
} from "@/api/client";

export default function LookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const index = Number(id);
  const router = useRouter();
  const { result, jobId, remotePhotoUrl, preferences } = useStyleSession();
  const look = result?.looks?.[index];

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
        {look.description && (
          <Text className="mt-4 text-sm leading-6 text-dim">{look.description}</Text>
        )}

        {look.items && look.items.length > 0 && (
          <View className="mt-8">
            <Text className="text-xs uppercase tracking-widest text-muted">
              Breakdown
            </Text>
            {look.items.map((item, i) => (
              <View
                key={i}
                className="mt-3 rounded-xl border border-border bg-ink/40 p-3"
              >
                <Text className="text-[10px] uppercase text-muted">
                  {item.category}
                </Text>
                <Text className="mt-1 text-sm text-cream">{item.description}</Text>
              </View>
            ))}
          </View>
        )}

        <View className="mt-8">
          <Text className="text-xs uppercase tracking-widest text-muted">
            Shop
          </Text>
          {(() => {
            const shoppable = (look.products ?? []).filter(
              (p) =>
                p.productUrl &&
                p.source !== "demo" &&
                !/example\.com/i.test(p.productUrl) &&
                p.verified === true &&
                p.availability !== "out_of_stock"
            );
            if (shoppable.length === 0) {
              return (
                <Text className="mt-3 text-sm italic text-muted">
                  {(look.products ?? []).length
                    ? "Verifying product links…"
                    : "Finding products that match this look…"}
                </Text>
              );
            }
            return shoppable.map((p, i) => (
              <Pressable
                key={i}
                onPress={() =>
                  openShop(p.canonicalUrl ?? p.productUrl, p.productCacheId)
                }
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
                </View>
              </Pressable>
            ));
          })()}
        </View>
      </ScrollView>

      <View className="mt-4 gap-3">
        <Button
          label="Refine with stylist"
          variant="ghost"
          onPress={() => router.push("/(app)/refine")}
        />
        <Button
          label="HD fashion board"
          variant="ghost"
          onPress={async () => {
            if (!jobId) return;
            try {
              await requestHdRender({
                jobId,
                lookIndex: index,
                userPhotoUrl: remotePhotoUrl ?? undefined,
              });
              Alert.alert("Rendering", "High-quality board is generating.");
            } catch (e) {
              Alert.alert("HD render", e instanceof Error ? e.message : "Failed");
            }
          }}
        />
        <Button
          label="Save look"
          onPress={async () => {
            await saveOutfit({
              name: look.label,
              occasion: preferences.occasion,
              snapshot: { look, index, result },
            });
            Alert.alert("Saved", "Added to your library.");
          }}
        />
      </View>
    </Screen>
  );
}
