import * as Updates from "expo-updates";

/** Pull latest OTA bundle on launch (production/preview builds only). */
export async function checkForUpdatesOnLaunch(): Promise<void> {
  if (__DEV__) return;
  if (!Updates.isEnabled) return;

  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (err) {
    // Retry once — transient network on cold start is common.
    try {
      await new Promise((r) => setTimeout(r, 2000));
      const retry = await Updates.checkForUpdateAsync();
      if (retry.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch {
      console.warn("[updates] check failed:", err);
    }
  }
}

export function getUpdateDiagnostics(): {
  runtimeVersion: string | null;
  channel: string | null;
  updateId: string | null;
  isEmbeddedLaunch: boolean;
} {
  return {
    runtimeVersion: Updates.runtimeVersion ?? null,
    channel: Updates.channel ?? null,
    updateId: Updates.updateId ?? null,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
  };
}
