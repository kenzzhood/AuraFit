import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Screen } from "../../../src/components/ui/Screen";
import { Button } from "../../../src/components/ui/Button";
import { useRouter } from "expo-router";
import {
  listWardrobeItems,
  createWardrobeItem,
  deleteWardrobeItem,
  uploadImage,
  AuthRequiredError,
} from "../../../src/api/client";
import type { WardrobeItem } from "../../../src/api/types";

const UPLOAD_QUALITY = 0.72;

const CATEGORY_LABELS: Record<WardrobeItem["category"], string> = {
  TOP: "Top",
  BOTTOM: "Bottom",
  DRESS: "Dress",
  OUTERWEAR: "Outerwear",
  FOOTWEAR: "Footwear",
  ACCESSORY: "Accessory",
  OTHER: "Piece",
};

export default function WardrobeScreen() {
  const qc = useQueryClient();
  const router = useRouter();
  const [uploadStage, setUploadStage] = useState<
    "idle" | "uploading" | "tagging"
  >("idle");

  const itemsQuery = useQuery({
    queryKey: ["wardrobe"],
    queryFn: listWardrobeItems,
  });

  const createItem = useMutation({
    mutationFn: createWardrobeItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wardrobe"] });
    },
  });

  const removeItem = useMutation({
    mutationFn: deleteWardrobeItem,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["wardrobe"] });
      const prev = qc.getQueryData<WardrobeItem[]>(["wardrobe"]);
      qc.setQueryData<WardrobeItem[]>(["wardrobe"], (xs) =>
        (xs ?? []).filter((i) => i.id !== id)
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["wardrobe"], ctx.prev);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wardrobe"] });
    },
  });

  const pickAndUpload = useCallback(
    async (useCamera: boolean) => {
      const perm = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          useCamera
            ? "Allow camera access in Settings to take a photo."
            : "Allow Photos access in Settings to add wardrobe pieces."
        );
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        quality: UPLOAD_QUALITY,
        allowsEditing: true,
        exif: false,
      };
      const result = useCamera
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];

      try {
        setUploadStage("uploading");
        const fileName = `wardrobe-${Date.now()}.jpg`;
        const up = await uploadImage({
          uri: asset.uri,
          fileName,
          contentType: "image/jpeg",
          kind: "wardrobe",
        });
        setUploadStage("tagging");
        await createItem.mutateAsync({
          blobPath: up.path,
          imageUrl: up.url,
        });
      } catch (e) {
        if (e instanceof AuthRequiredError) {
          Alert.alert("Sign in expired", e.message, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Sign in again",
              onPress: () => router.replace("/(auth)/sign-in"),
            },
          ]);
        } else {
          Alert.alert(
            "Upload failed",
            e instanceof Error ? e.message : "Please try again."
          );
        }
      } finally {
        setUploadStage("idle");
      }
    },
    [createItem, router]
  );

  const confirmDelete = (item: WardrobeItem) => {
    Alert.alert(
      "Remove piece?",
      "This will permanently delete the item from your wardrobe.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => removeItem.mutate(item.id),
        },
      ]
    );
  };

  const items = itemsQuery.data ?? [];
  const loading = itemsQuery.isLoading && !itemsQuery.data;
  const busy = uploadStage !== "idle";

  return (
    <Screen className="py-6">
      <Text className="text-[10px] uppercase tracking-[0.35em] text-muted">
        Wardrobe
      </Text>
      <Text className="mt-3 font-display text-3xl text-cream">Your pieces</Text>
      <Text className="mt-2 text-sm leading-6 text-dim">
        Photos are auto-categorized and used when you generate looks from your
        own wardrobe.
      </Text>

      <View className="mt-6 flex-row gap-3">
        <Button
          label={
            busy
              ? uploadStage === "uploading"
                ? "Uploading…"
                : "Categorizing…"
              : "Add from gallery"
          }
          loading={busy}
          disabled={busy}
          className="flex-1"
          onPress={() => pickAndUpload(false)}
        />
        <Button
          label="Camera"
          variant="ghost"
          disabled={busy}
          onPress={() => pickAndUpload(true)}
        />
      </View>

      <ScrollView
        className="mt-6 flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={itemsQuery.isRefetching}
            onRefresh={() => itemsQuery.refetch()}
            tintColor="#d4b896"
          />
        }
      >
        {loading ? (
          <View className="items-center py-16">
            <ActivityIndicator color="#d4b896" />
          </View>
        ) : items.length === 0 ? (
          <View className="mt-10 items-center rounded-2xl border border-dashed border-border bg-ink/40 px-6 py-12">
            <Text className="text-center text-sm text-dim">
              No pieces yet. Add a few of your favourites to unlock the
              "wardrobe" generation path.
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-3 pb-8">
            {items.map((item) => {
              const src = item.readUrl ?? item.imageUrl;
              return (
                <Pressable
                  key={item.id}
                  onLongPress={() => confirmDelete(item)}
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
                      <View className="h-full w-full items-center justify-center">
                        <Text className="text-xs text-muted">No image</Text>
                      </View>
                    )}
                    <View className="absolute left-2 top-2 rounded-full bg-void/80 px-2 py-0.5">
                      <Text className="text-[10px] uppercase tracking-widest text-champagne">
                        {CATEGORY_LABELS[item.category] ?? "Piece"}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => confirmDelete(item)}
                      hitSlop={8}
                      className="absolute right-2 top-2 rounded-full bg-void/80 px-2 py-1"
                    >
                      <Text className="text-[10px] text-cream">Remove</Text>
                    </Pressable>
                  </View>
                  {item.tags && item.tags.length > 0 && (
                    <View className="flex-row flex-wrap gap-1 p-2">
                      {item.tags.slice(0, 3).map((t, i) => (
                        <Text
                          key={i}
                          className="rounded-full bg-stage px-2 py-0.5 text-[10px] text-dim"
                        >
                          {t}
                        </Text>
                      ))}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
