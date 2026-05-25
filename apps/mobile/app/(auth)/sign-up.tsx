import { View, Text, TextInput, ScrollView } from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Screen } from "../../src/components/ui/Screen";
import { Button } from "../../src/components/ui/Button";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSignUp = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace("/(app)/upload");
      } else {
        setError("Verification incomplete. Try again.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <Screen className="justify-center gap-6">
        <View>
          <Text className="font-display text-3xl text-cream">Check your email</Text>
          <Text className="mt-2 text-sm text-dim">
            We sent a 6-digit code to {email}. Enter it below.
          </Text>
        </View>
        <TextInput
          placeholder="Verification code"
          placeholderTextColor="#6b655c"
          keyboardType="number-pad"
          value={code}
          onChangeText={setCode}
          maxLength={6}
          className="rounded-2xl border border-border bg-ink px-4 py-4 text-cream text-center text-2xl tracking-widest"
        />
        {error && <Text className="text-sm text-red-400">{error}</Text>}
        <Button label="Verify email" onPress={onVerify} loading={loading} />
        <Button
          label="Resend code"
          variant="ghost"
          onPress={async () => {
            try {
              await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
            } catch {}
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen className="justify-center gap-6">
      <View>
        <Text className="font-display text-3xl text-cream">Create account</Text>
        <Text className="mt-2 text-sm text-dim">
          Start your AI styling journey.
        </Text>
      </View>
      <TextInput
        placeholder="Email"
        placeholderTextColor="#6b655c"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        className="rounded-2xl border border-border bg-ink px-4 py-4 text-cream"
      />
      <TextInput
        placeholder="Password"
        placeholderTextColor="#6b655c"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
        className="rounded-2xl border border-border bg-ink px-4 py-4 text-cream"
      />
      {error && <Text className="text-sm text-red-400">{error}</Text>}
      <Button label="Create account" onPress={onSignUp} loading={loading} />
      <Link href="/(auth)/sign-in" className="text-center text-xs text-muted">
        Already have an account? Sign in
      </Link>
      <Link href="/" className="text-center text-xs text-muted">
        Back
      </Link>
    </Screen>
  );
}
