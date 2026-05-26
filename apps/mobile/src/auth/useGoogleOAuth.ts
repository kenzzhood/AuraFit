import { useCallback, useState } from "react";
import { useOAuth } from "@clerk/clerk-expo";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

type Result = {
  startGoogleOAuth: () => Promise<void>;
  loading: boolean;
  error: string | null;
};

export function useGoogleOAuth(onSuccess?: () => void): Result {
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startGoogleOAuth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const redirectUrl = Linking.createURL("oauth-native-callback");
      const result = await startOAuthFlow({ redirectUrl });

      if (result?.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        onSuccess?.();
      } else if (result?.signIn || result?.signUp) {
        setError(
          "Additional details required. Open the email flow to finish signing in."
        );
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Google sign-in could not be completed.";
      if (!/cancel/i.test(message) && !/dismiss/i.test(message)) {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [startOAuthFlow, onSuccess]);

  return { startGoogleOAuth, loading, error };
}
