import { View, Text, TextInput } from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState, useCallback } from "react";
import { Screen } from "../../src/components/ui/Screen";
import { Button } from "../../src/components/ui/Button";
import { GoogleButton } from "../../src/components/ui/GoogleButton";
import { useGoogleOAuth } from "../../src/auth/useGoogleOAuth";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const goNext = useCallback(() => {
    router.replace("/(app)/upload");
  }, [router]);

  const {
    startGoogleOAuth,
    loading: googleLoading,
    error: googleError,
  } = useGoogleOAuth(goNext);

  const onSignIn = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        goNext();
      } else {
        setError("Additional verification required. Check your email and try again.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const formError = error ?? googleError;

  return (
    <Screen className="justify-center gap-5">
      <View>
        <Text className="font-display text-3xl text-cream">Welcome back</Text>
        <Text className="mt-2 text-sm text-dim">
          Sign in to continue your styling session.
        </Text>
      </View>

      <GoogleButton onPress={startGoogleOAuth} loading={googleLoading} />

      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs uppercase tracking-widest text-muted">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      <TextInput
        placeholder="Email"
        placeholderTextColor="#6b655c"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        className="rounded-2xl border border-border bg-ink px-4 py-4 text-cream"
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor="#6b655c"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        className="rounded-2xl border border-border bg-ink px-4 py-4 text-cream"
      />
      {formError && <Text className="text-sm text-red-400">{formError}</Text>}
      <Button label="Sign in" onPress={onSignIn} loading={loading} />
      <Link href="/(auth)/sign-up" className="text-center text-xs text-muted">
        Don&apos;t have an account? Create one
      </Link>
      <Link href="/" className="text-center text-xs text-muted">
        Back
      </Link>
    </Screen>
  );
}
