import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob";

function getCredential() {
  const name = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const key = process.env.AZURE_STORAGE_ACCOUNT_KEY;
  if (!name || !key) {
    throw new Error("Missing AZURE_STORAGE_ACCOUNT_NAME or AZURE_STORAGE_ACCOUNT_KEY");
  }
  return { name, key, credential: new StorageSharedKeyCredential(name, key) };
}

export function getBlobServiceClient(): BlobServiceClient {
  const { name, credential } = getCredential();
  return new BlobServiceClient(
    `https://${name}.blob.core.windows.net`,
    credential
  );
}

export async function ensureContainer(containerName: string): Promise<void> {
  const client = getBlobServiceClient();
  const container = client.getContainerClient(containerName);
  await container.createIfNotExists();
}

/**
 * Issue a short-lived SAS for client direct upload (optional) or server-side only use.
 */
export function getBlobReadSasUrl(
  containerName: string,
  blobName: string,
  expiresMinutes = 60
): string {
  const { name, credential } = getCredential();
  const startsOn = new Date();
  const expiresOn = new Date(startsOn.getTime() + expiresMinutes * 60 * 1000);
  const sas = generateBlobSASQueryParameters(
    {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse("r"),
      startsOn,
      expiresOn,
    },
    credential
  ).toString();
  return `https://${name}.blob.core.windows.net/${containerName}/${blobName}?${sas}`;
}

/** Returns null when Azure keys are not configured (local dev). */
export function tryGetBlobReadSasUrl(
  containerName: string,
  blobName: string,
  expiresMinutes = 60
): string | null {
  try {
    return getBlobReadSasUrl(containerName, blobName, expiresMinutes);
  } catch {
    return null;
  }
}

export async function uploadBuffer(
  containerName: string,
  blobName: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const client = getBlobServiceClient();
  const block = client.getContainerClient(containerName).getBlockBlobClient(blobName);
  await block.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
  return block.url;
}
