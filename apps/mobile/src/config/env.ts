import Constants from "expo-constants";

// v3 — bundle-busted 2026-05-26 to force fresh Metro export
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  "http://localhost:3000"
).replace(/\/$/, ""); // strip trailing slash

export const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
