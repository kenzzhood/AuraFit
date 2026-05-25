import * as FileSystem from "expo-file-system";

const AURAFIT_DIR = `${FileSystem.documentDirectory}aurafit/`;

/**
 * Ensure the aurafit sub-directory exists. Safe to call multiple times.
 */
async function ensureDir(subDir: string): Promise<string> {
  const path = `${AURAFIT_DIR}${subDir}/`;
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
  return path;
}

/**
 * Save a base64-encoded image to local device storage.
 * Returns the local file URI on success.
 * Throws on failure (caller should decide whether this is fatal).
 */
export async function saveLocalImage(
  subDir: string,
  fileName: string,
  base64Data: string
): Promise<string> {
  const dir = await ensureDir(subDir);
  const fileUri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64Data, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
}

/**
 * Read a local image as a base64 string.
 * Returns null if the file does not exist.
 */
export async function readLocalImage(
  uri: string
): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return null;
  }
}

/**
 * Delete a local image by URI.
 * Non-fatal — silently ignores errors.
 */
export async function deleteLocalImage(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Ignore — deletion failure is non-fatal
  }
}

/**
 * List all locally stored images in a subdirectory.
 * Returns an empty array if the directory doesn't exist.
 */
export async function listLocalImages(subDir: string): Promise<string[]> {
  try {
    const path = `${AURAFIT_DIR}${subDir}/`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return [];
    const items = await FileSystem.readDirectoryAsync(path);
    return items.map((name) => `${path}${name}`);
  } catch {
    return [];
  }
}
