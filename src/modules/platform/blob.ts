import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface BlobStore {
  put(key: string, bytes: Uint8Array): Promise<string>;
}

export function localBlob(root = ".data/blobs"): BlobStore {
  return {
    async put(key, bytes) {
      const safe = key.replace(/[^a-z0-9/_-]+/gi, "");
      const path = join(root, safe);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, bytes);
      return path;
    },
  };
}
