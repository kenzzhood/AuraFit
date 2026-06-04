import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../src/components/ui/Screen";
import { Button } from "../../src/components/ui/Button";
import { useStyleSession } from "../../src/store/useStyleSession";
import { deleteWardrobeItem, listWardrobeItems } from "../../src/api/client";
import { cn } from "../../src/lib/cn";
import type { WardrobeMode } from "../../src/api/types";

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

const WARDROBE_MODES: {
  id: WardrobeMode;
  label: string;
  hint: string;
}[] = [
  {
    id: "mix",
    label: "Mix only",
    hint: "Uses your uploaded wardrobe pieces only.",
  },
  {
    id: "pair",
    label: "Pair with online",
    hint: "Uses your selected pieces and finds real products online.",
  },
];

function categoryLabel(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

export default function StyleScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { preferences, setPreferences, remotePhotoUrl } = useStyleSession();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [occasion, setOccasion] = useState(preferences.occasion ?? "");
  const [location, setLocation] = useState(preferences.location ?? "");
  const [notes, setNotes] = useState(preferences.style ?? "");

  const path = preferences.path ?? "online";
  const wardrobeMode = preferences.wardrobeMode ?? "mix";
  const wardrobeItemIds = preferences.wardrobeItemIds ?? [];

  const wardrobeQuery = useQuery({
    queryKey: ["wardrobe"],
    queryFn: listWardrobeItems,
    enabled: path === "wardrobe",
  });

  const wardrobeItems = wardrobeQuery.data ?? [];
  const hideBudget = path === "wardrobe" && wardrobeMode === "mix";

  const wardrobeBlocked = useMemo(() => {
    if (path !== "wardrobe") return null;
    if (wardrobeItems.length === 0) {
      return "Add wardrobe items first, or switch to Shop online.";
    }
    if (wardrobeMode === "pair" && wardrobeItemIds.length === 0) {
      return "Pick at least one anchor piece for pair mode.";
    }
    return null;
  }, [path, wardrobeItems.length, wardrobeMode, wardrobeItemIds.length]);

  const toggleWardrobeItem = (id: string) => {
    const next = wardrobeItemIds.includes(id)
      ? wardrobeItemIds.filter((x) => x !== id)
      : [...wardrobeItemIds, id];
    setPreferences({ wardrobeItemIds: next });
  };

  const confirmDeleteWardrobeItem = (id: string, label: string) => {
    Alert.alert("Remove piece?", "This will permanently delete it from your wardrobe.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingId(id);
          try {
            await deleteWardrobeItem(id);
            setPreferences({
              wardrobeItemIds: wardrobeItemIds.filter((x) => x !== id),
            });
            await qc.invalidateQueries({ queryKey: ["wardrobe"] });
          } catch (e) {
            Alert.alert(
              "Delete failed",
              e instanceof Error ? e.message : "Please try again."
            );
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  return (
    <Screen className="py-6">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <Text className="text-[10px] uppercase tracking-[0.35em] text-muted">
          Step 2
        </Text>
        <Text className="mt-3 font-display text-3xl text-cream">
          Style preferences
        </Text>
        <Text className="mt-2 text-sm text-dim">
          Tell us the vibe — we will generate 6 complete looks for you.
        </Text>

        {/* Path selection */}
        <View className="mt-8 flex-row gap-3">
          <Pressable
            onPress={() => setPreferences({ path: "online" })}
            className={cn(
              "flex-1 rounded-2xl border p-4",
              path === "online"
                ? "border-champagne bg-champagne/10"
                : "border-border"
            )}
          >
            <Text className="font-medium text-cream">Shop online</Text>
            <Text className="mt-1 text-xs text-dim">
              Fresh product discovery from the web.
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPreferences({ path: "wardrobe" })}
            className={cn(
              "flex-1 rounded-2xl border p-4",
              path === "wardrobe"
                ? "border-champagne bg-champagne/10"
                : "border-border"
            )}
          >
            <Text className="font-medium text-cream">My wardrobe</Text>
            <Text className="mt-1 text-xs text-dim">
              Style using pieces you already own.
            </Text>
          </Pressable>
        </View>

        {/* Wardrobe mode + picker */}
        {path === "wardrobe" && (
          <View className="mt-6 rounded-2xl border border-border p-3">
            {wardrobeQuery.isLoading ? (
              <View className="items-center py-6">
                <ActivityIndicator color="#d4b896" />
              </View>
            ) : wardrobeItems.length === 0 ? (
              <Text className="text-xs text-muted">
                Add wardrobe items first, or switch to Shop online.
              </Text>
            ) : (
              <>
                <View className="flex-row gap-2 rounded-xl border border-border bg-void/40 p-1">
                  {WARDROBE_MODES.map((m) => {
                    const active = wardrobeMode === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setPreferences({ wardrobeMode: m.id })}
                        className={cn(
                          "flex-1 rounded-lg px-3 py-2",
                          active ? "bg-raised" : ""
                        )}
                      >
                        <Text
                          className={cn(
                            "text-xs font-medium",
                            active ? "text-cream" : "text-muted"
                          )}
                        >
                          {m.label}
                        </Text>
                        <Text className="mt-0.5 text-[10px] leading-4 text-dim">
                          {m.hint}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View className="mt-3 flex-row items-center justify-between">
                  <Text className="text-[10px] uppercase tracking-[0.18em] text-muted">
                    {wardrobeItemIds.length === 0
                      ? wardrobeMode === "pair"
                        ? "Pick at least one anchor piece"
                        : `Optional · ${wardrobeItems.length} item${wardrobeItems.length === 1 ? "" : "s"} available`
                      : `${wardrobeItemIds.length} selected`}
                  </Text>
                  {wardrobeItemIds.length > 0 && (
                    <Pressable onPress={() => setPreferences({ wardrobeItemIds: [] })}>
                      <Text className="text-xs text-muted underline">Clear</Text>
                    </Pressable>
                  )}
                </View>

                <View className="mt-3 flex-row flex-wrap gap-2">
                  {wardrobeItems.map((it) => {
                    const selected = wardrobeItemIds.includes(it.id);
                    const src = it.readUrl ?? it.imageUrl;
                    const label = categoryLabel(it.category);
                    const isDeleting = deletingId === it.id;
                    return (
                      <View
                        key={it.id}
                        className={cn(
                          "overflow-hidden rounded-xl border",
                          selected
                            ? "border-champagne ring-2 ring-champagne/50"
                            : "border-border",
                          isDeleting && "opacity-50"
                        )}
                        style={{ width: "31%" }}
                      >
                        <Pressable
                          onPress={() => toggleWardrobeItem(it.id)}
                          disabled={isDeleting}
                        >
                          <View style={{ aspectRatio: 1 }} className="bg-stage">
                            {src ? (
                              <Image
                                source={{ uri: src }}
                                className="h-full w-full"
                                resizeMode="cover"
                              />
                            ) : (
                              <View className="h-full items-center justify-center px-1">
                                <Text className="text-center text-[9px] uppercase tracking-widest text-muted">
                                  {label}
                                </Text>
                              </View>
                            )}
                            {selected && (
                              <View className="absolute left-1.5 top-1.5 h-5 w-5 items-center justify-center rounded-full bg-champagne">
                                <Text className="text-[10px] font-bold text-void">
                                  ✓
                                </Text>
                              </View>
                            )}
                            <View className="absolute inset-x-0 bottom-0 bg-void/75 px-1 py-1">
                              <Text
                                className="text-[9px] uppercase tracking-widest text-cream"
                                numberOfLines={1}
                              >
                                {label}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDeleteWardrobeItem(it.id, label)}
                          disabled={isDeleting}
                          className="absolute right-1 top-1 rounded-full bg-void/85 px-1.5 py-0.5"
                        >
                          <Text className="text-[9px] text-cream">×</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        )}

        <Text className="mt-8 text-xs uppercase tracking-widest text-muted">
          Style
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {STYLE_TYPES.map((v) => (
            <Pressable
              key={v}
              onPress={() => setPreferences({ styleType: v })}
              className={cn(
                "rounded-full border px-4 py-2",
                preferences.styleType === v
                  ? "border-champagne bg-champagne/15"
                  : "border-border"
              )}
            >
              <Text
                className={cn(
                  "text-xs",
                  preferences.styleType === v ? "text-champagne" : "text-dim"
                )}
              >
                {v}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="mt-8 text-xs uppercase tracking-widest text-muted">
          Occasion
        </Text>
        <TextInput
          value={occasion}
          onChangeText={setOccasion}
          placeholder="Daily outing, date, office…"
          placeholderTextColor="#6b6b73"
          className="mt-2 rounded-2xl border border-border bg-ink px-4 py-3 text-cream"
        />

        <Text className="mt-6 text-xs uppercase tracking-widest text-muted">
          Location
        </Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Chennai, India"
          placeholderTextColor="#6b6b73"
          className="mt-2 rounded-2xl border border-border bg-ink px-4 py-3 text-cream"
        />

        {!hideBudget && (
          <View className="mt-6 flex-row gap-3">
            <View className="flex-1">
              <Text className="text-xs uppercase tracking-widest text-muted">
                Budget min ₹
              </Text>
              <TextInput
                keyboardType="number-pad"
                value={String(preferences.budgetMin ?? 2000)}
                onChangeText={(t) =>
                  setPreferences({ budgetMin: Number(t) || 0 })
                }
                className="mt-2 rounded-2xl border border-border bg-ink px-4 py-3 text-cream"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs uppercase tracking-widest text-muted">
                Budget max ₹
              </Text>
              <TextInput
                keyboardType="number-pad"
                value={String(preferences.budgetMax ?? 6000)}
                onChangeText={(t) =>
                  setPreferences({ budgetMax: Number(t) || 0 })
                }
                className="mt-2 rounded-2xl border border-border bg-ink px-4 py-3 text-cream"
              />
            </View>
          </View>
        )}

        <Text className="mt-6 text-xs uppercase tracking-widest text-muted">
          Optional preferences
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Pinterest aesthetic, favorite colors, brands…"
          placeholderTextColor="#6b6b73"
          className="mt-2 rounded-2xl border border-border bg-ink px-4 py-3 text-cream"
        />

        {wardrobeBlocked && (
          <View className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <Text className="text-xs leading-5 text-amber-200/90">
              {wardrobeBlocked}
            </Text>
          </View>
        )}
      </ScrollView>

      <Text className="mt-4 text-center text-[11px] leading-5 text-muted">
        A full board takes about 1–2 minutes. Keep this screen open while we
        render each step.
      </Text>
      <Button
        label="Generate looks"
        className="mt-3"
        disabled={!remotePhotoUrl || !!wardrobeBlocked}
        onPress={() => {
          setPreferences({
            occasion: occasion || undefined,
            location: location || undefined,
            style: notes || undefined,
            renderQuality: "medium",
            budgetMin:
              hideBudget ? undefined : preferences.budgetMin,
            budgetMax:
              hideBudget ? undefined : preferences.budgetMax,
            wardrobeItemIds:
              path === "wardrobe" && wardrobeItemIds.length
                ? wardrobeItemIds
                : undefined,
            wardrobeMode: path === "wardrobe" ? wardrobeMode : undefined,
          });
          router.push("/(app)/generating");
        }}
      />
    </Screen>
  );
}
