import Constants from "expo-constants";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  "http://localhost:3000";

export const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
