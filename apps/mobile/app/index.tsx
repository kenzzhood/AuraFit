import { View, Text, ImageBackground } from "react-native";
import { Link, Redirect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";

export default function LandingScreen() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;
  if (isSignedIn) {
    return <Redirect href="/(app)/upload" />;
  }

  return (
    <Screen className="justify-between py-8">
      <View>
        <Text className="text-[10px] font-medium uppercase tracking-[0.4em] text-champagne">
          Aurafit
        </Text>
        <Text className="mt-6 font-display text-4xl leading-tight text-cream">
          Your AI stylist,{"\n"}quietly exceptional.
        </Text>
        <Text className="mt-4 max-w-xs text-sm leading-6 text-dim">
          Upload once. Choose your vibe. Get editorial outfit directions with
          real shop links — your wardrobe stays on your device.
        </Text>
      </View>

      <View className="overflow-hidden rounded-3xl border border-border">
        <ImageBackground
          source={{
            uri: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
          }}
          className="h-56 justify-end p-5"
          resizeMode="cover"
        >
          <Text className="text-xs uppercase tracking-widest text-cream/80">
            Six looks. One you.
          </Text>
        </ImageBackground>
      </View>

      <View className="gap-3">
        <Link href="/(auth)/sign-up" asChild>
          <Button label="Begin styling" />
        </Link>
        <Link href="/(auth)/sign-in" asChild>
          <Button label="Sign in" variant="ghost" />
        </Link>
      </View>
    </Screen>
  );
}

