import type { StorageProvider } from "@/lib/storage/providers/types";
import { cloudinaryStorageProvider } from "@/lib/storage/providers/cloudinary";
import { azureBlobStorageProvider } from "@/lib/storage/providers/azure-blob";

export type StorageProviderName = "cloudinary" | "azure";

export function getStorageProviderName(): StorageProviderName {
  const p = (process.env.STORAGE_PROVIDER ?? "cloudinary").toLowerCase();
  if (p === "azure") return "azure";
  return "cloudinary";
}

export function getStorageProvider(): StorageProvider {
  const preferred = getStorageProviderName();
  if (preferred === "azure" && azureBlobStorageProvider.isConfigured()) {
    return azureBlobStorageProvider;
  }
  if (cloudinaryStorageProvider.isConfigured()) {
    return cloudinaryStorageProvider;
  }
  if (azureBlobStorageProvider.isConfigured()) {
    return azureBlobStorageProvider;
  }
  return preferred === "azure"
    ? azureBlobStorageProvider
    : cloudinaryStorageProvider;
}

export function isStorageConfigured(): boolean {
  return (
    cloudinaryStorageProvider.isConfigured() ||
    azureBlobStorageProvider.isConfigured()
  );
}
