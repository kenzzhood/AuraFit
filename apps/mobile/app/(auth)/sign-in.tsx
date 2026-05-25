import { View, Text } from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Screen } from "../../src/components/ui/Screen";
import { Button } from "../../src/components/ui/Button";
import { TextInput } from "react-native";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        router.replace("/(app)/upload");
      } else {
        setError("Complete sign-in in your email or use OAuth in web for now.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen className="justify-center gap-6">
      <View>
        <Text className="font-display text-3xl text-cream">Welcome back</Text>
        <Text className="mt-2 text-sm text-dim">
          Sign in to continue your styling session.
        </Text>
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
      {error && <Text className="text-sm text-red-400">{error}</Text>}
      <Button label="Sign in" onPress={onSignIn} loading={loading} />
      <Link href="/" className="text-center text-xs text-muted">
        Back
      </Link>
    </Screen>
  );
}
