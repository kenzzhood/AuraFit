import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../src/components/ui/Screen";
import { useStyleSession } from "../../src/store/useStyleSession";

export default function ResultsScreen() {
  const router = useRouter();
  const { result, setSelectedLook } = useStyleSession();
  const looks = result?.looks ?? [];

  return (
    <Screen className="py-6">
      <Text className="text-[10px] uppercase tracking-[0.35em] text-muted">
        Your looks
      </Text>
      <Text className="mt-3 font-display text-3xl text-cream">
        Pick a direction
      </Text>
      {result?.boardImageUrl && (
        <Image
          source={{ uri: result.boardImageUrl }}
          className="mt-6 h-48 w-full rounded-2xl"
          resizeMode="cover"
        />
      )}
      <ScrollView className="mt-6 flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-8">
          {looks.map((look, i) => (
            <Pressable
              key={i}
              onPress={() => {
                setSelectedLook(i);
                router.push(`/(app)/look/${i}`);
              }}
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
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
