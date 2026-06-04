import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as WebBrowser from "expo-web-browser";
import { tokenCache } from "../src/auth/tokenCache";
import { CLERK_PUBLISHABLE_KEY } from "../src/config/env";
import { ApiAuthBridge } from "../src/auth/ApiAuthBridge";
import { checkForUpdatesOnLaunch } from "../src/updates/checkForUpdates";

WebBrowser.maybeCompleteAuthSession();

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    void checkForUpdatesOnLaunch();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        tokenCache={tokenCache}
      >
        <ClerkLoaded>
          <QueryClientProvider client={queryClient}>
            <ApiAuthBridge />
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#070608" },
                animation: "fade",
              }}
            />
          </QueryClientProvider>
        </ClerkLoaded>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
