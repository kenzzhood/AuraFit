import { getStorageProvider } from "@/lib/storage/provider";

export async function uploadUserImage(params: {
  clerkUserId: string;
  kind: "wardrobe" | "profile" | "outfit_render";
  fileName: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ path: string; url: string }> {
  const { clerkUserId, kind, fileName, buffer, contentType } = params;
  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const storage = getStorageProvider();

  return storage.upload({
    buffer,
    folder: `aurafit/${clerkUserId}/${kind}`,
    publicIdStem: safeName.replace(/\.[^.]+$/, "") || safeName,
    contentType,
  });
}
