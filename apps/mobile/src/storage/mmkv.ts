import { MMKV } from "react-native-mmkv";

export const storage = new MMKV({ id: "aurafit-preferences" });

export function getPref<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setPref<T>(key: string, value: T) {
  storage.set(key, JSON.stringify(value));
}
