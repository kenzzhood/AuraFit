import {
  ensureContainer,
  tryGetBlobReadSasUrl,
  uploadBuffer,
} from "@/lib/azure/blob";
import type { StorageProvider, UploadParams } from "./types";

function isAzureConfigured(): boolean {
  return !!(
    process.env.AZURE_STORAGE_ACCOUNT_NAME &&
    process.env.AZURE_STORAGE_ACCOUNT_KEY
  );
}

const WARDROBE_CONTAINER = () =>
  process.env.AZURE_STORAGE_CONTAINER_WARDROBES ?? "wardrobes";
const OUTFIT_CONTAINER = () =>
  process.env.AZURE_STORAGE_CONTAINER_OUTFITS ?? "outfits";
const PROFILE_CONTAINER = () =>
  process.env.AZURE_STORAGE_CONTAINER_PROFILES ?? "profiles";

/** Map upload folder to the right blob container. */
function pickContainer(folder: string): string {
  const f = folder.toLowerCase();
  if (f.includes("wardrobe")) return WARDROBE_CONTAINER();
  if (f.includes("outfit") || f.includes("look") || f.includes("board"))
    return OUTFIT_CONTAINER();
  if (f.includes("profile")) return PROFILE_CONTAINER();
  return OUTFIT_CONTAINER();
}

/** Parse a path like "<container>:<blobKey>" stored from prior uploads. */
function splitContainerPath(path: string): { container: string; blob: string } {
  const idx = path.indexOf(":");
  if (idx > 0 && !path.startsWith("http")) {
    return { container: path.slice(0, idx), blob: path.slice(idx + 1) };
  }
  return { container: pickContainer(path), blob: path };
}

const READ_SAS_DAYS = 365;

export const azureBlobStorageProvider: StorageProvider = {
  name: "azure",

  isConfigured() {
    return isAzureConfigured();
  },

  async upload({ buffer, folder, publicIdStem, contentType }: UploadParams) {
    const container = pickContainer(folder);
    const blobKey = `${folder}/${publicIdStem}`;
    await ensureContainer(container);
    await uploadBuffer(
      container,
      blobKey,
      buffer,
      contentType ?? "image/jpeg"
    );

    // Containers are private by default; issue a long-lived read SAS so the
    // returned URL is browser-loadable.
    const sasUrl = tryGetBlobReadSasUrl(
      container,
      blobKey,
      READ_SAS_DAYS * 24 * 60
    );

    return {
      path: `${container}:${blobKey}`,
      url: sasUrl ?? `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${container}/${blobKey}`,
    };
  },

  getReadUrl(path: string) {
    if (path.startsWith("http")) return path;
    const cdn = process.env.AZURE_CDN_ENDPOINT;
    const { container, blob } = splitContainerPath(path);
    if (cdn) return `${cdn.replace(/\/$/, "")}/${container}/${blob}`;
    return tryGetBlobReadSasUrl(container, blob, READ_SAS_DAYS * 24 * 60);
  },
};
