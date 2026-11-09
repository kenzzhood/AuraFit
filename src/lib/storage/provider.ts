import type { StorageProvider } from "@/lib/storage/providers/types";
import { cloudinaryStorageProvider } from "@/lib/storage/providers/cloudinary";
import { azureBlobStorageProvider } from "@/lib/storage/providers/azure-blob";

export type StorageProviderName = "cloudinary" | "azure";

export function getStorageProviderName(): StorageProviderName {
  const p = (process.env.STORAGE_PROVIDER ?? "azure").toLowerCase();
  if (p === "cloudinary" && process.env.AURAFIT_ALLOW_CLOUDINARY === "true") {
    return "cloudinary";
  }
  return "azure";
}

export function getStorageProvider(): StorageProvider {
  const preferred = getStorageProviderName();
  if (preferred === "cloudinary" && cloudinaryStorageProvider.isConfigured()) {
    return cloudinaryStorageProvider;
  }
  return azureBlobStorageProvider;
}

export function isStorageConfigured(): boolean {
  return (
    cloudinaryStorageProvider.isConfigured() ||
    azureBlobStorageProvider.isConfigured()
  );
}
