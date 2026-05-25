import { getStorageProvider } from "@/lib/storage/provider";
import {
  isCloudinaryBlobPath,
  cloudinaryPublicIdFromBlobPath,
} from "@/lib/storage/cloudinary";
import { getCloudinaryReadUrl } from "@/lib/storage/cloudinary";

type ItemLike = {
  blobPath: string;
  imageUrl: string | null;
};

export function resolveWardrobeItemReadUrl(
  item: ItemLike,
  _azureContainer?: string
): string | null {
  if (item.imageUrl) return item.imageUrl;

  if (isCloudinaryBlobPath(item.blobPath)) {
    return (
      getCloudinaryReadUrl(cloudinaryPublicIdFromBlobPath(item.blobPath)) ??
      getStorageProvider().getReadUrl(item.blobPath)
    );
  }

  return getStorageProvider().getReadUrl(item.blobPath);
}
