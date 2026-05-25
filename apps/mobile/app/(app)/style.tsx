import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { useStyleSession } from "@/store/useStyleSession";
import { cn } from "@/lib/cn";

const VIBES = [
  "Minimal",
  "Streetwear",
  "Old Money",
  "Korean",
  "Smart Casual",
  "Luxury Casual",
  "Pinterest",
  "Formal",
  "Techwear",
];

export default function StyleScreen() {
  const router = useRouter();
  const { preferences, setPreferences, remotePhotoUrl } = useStyleSession();
  const [occasion, setOccasion] = useState(preferences.occasion ?? "");
  const [location, setLocation] = useState(preferences.location ?? "");
  const [notes, setNotes] = useState(preferences.style ?? "");

  return (
    <Screen className="py-6">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <Text className="text-[10px] uppercase tracking-[0.35em] text-muted">
          Step 2
        </Text>
        <Text className="mt-3 font-display text-3xl text-cream">Your vibe</Text>
        <Text className="mt-2 text-sm text-dim">
          Occasion, place, and budget — we keep it minimal.
        </Text>

        <Text className="mt-8 text-xs uppercase tracking-widest text-muted">
          Style
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {VIBES.map((v) => (
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
          placeholderTextColor="#6b655c"
          className="mt-2 rounded-2xl border border-border bg-ink px-4 py-3 text-cream"
        />

        <Text className="mt-6 text-xs uppercase tracking-widest text-muted">
          Location
        </Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Chennai, India"
          placeholderTextColor="#6b655c"
          className="mt-2 rounded-2xl border border-border bg-ink px-4 py-3 text-cream"
        />

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

        <Text className="mt-6 text-xs uppercase tracking-widest text-muted">
          Notes
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Pinterest aesthetic, favorite brands…"
          placeholderTextColor="#6b655c"
          className="mt-2 rounded-2xl border border-border bg-ink px-4 py-3 text-cream"
        />
      </ScrollView>

      <Button
        label="Generate looks"
        className="mt-4"
        disabled={!remotePhotoUrl}
        onPress={() => {
          setPreferences({
            occasion: occasion || undefined,
            location: location || undefined,
            style: notes || undefined,
            previewOnly: true,
          });
          router.push("/(app)/generating");
        }}
      />
    </Screen>
  );
}
