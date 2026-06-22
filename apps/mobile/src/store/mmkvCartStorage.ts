import type { StateStorage } from "zustand/middleware";
import { storage } from "../storage/mmkv";

export const mmkvCartStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => {
    storage.set(name, value);
  },
  removeItem: (name) => {
    storage.delete(name);
  },
};
