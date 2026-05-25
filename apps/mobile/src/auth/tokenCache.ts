import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const createTokenCache = () => ({
  getToken: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  saveToken: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      /* ignore */
    }
  },
});

export const tokenCache =
  Platform.OS === "web" ? undefined : createTokenCache();
