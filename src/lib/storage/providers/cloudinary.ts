import {
  isCloudinaryConfigured,
  uploadImageBuffer,
  getCloudinaryReadUrl,
  isCloudinaryBlobPath,
  cloudinaryPublicIdFromBlobPath,
} from "@/lib/storage/cloudinary";
import type { StorageProvider, UploadParams } from "./types";

export const cloudinaryStorageProvider: StorageProvider = {
  name: "cloudinary",

  isConfigured() {
    return isCloudinaryConfigured();
  },

  async upload({ buffer, folder, publicIdStem }: UploadParams) {
    const { blobPath, url } = await uploadImageBuffer({
      buffer,
      folder,
      publicIdStem,
    });
    return { path: blobPath, url };
  },

  getReadUrl(path: string, opts?: { width?: number }) {
    if (!isCloudinaryBlobPath(path)) return null;
    return getCloudinaryReadUrl(cloudinaryPublicIdFromBlobPath(path), opts);
  },
};
