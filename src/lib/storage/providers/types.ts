export type UploadParams = {
  buffer: Buffer;
  folder: string;
  publicIdStem: string;
  contentType?: string;
};

export type UploadResult = {
  path: string;
  url: string;
};

export interface StorageProvider {
  readonly name: string;
  isConfigured(): boolean;
  upload(params: UploadParams): Promise<UploadResult>;
  getReadUrl(path: string, opts?: { width?: number }): string | null;
  delete?(path: string): Promise<void>;
}
