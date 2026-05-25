export type TryOnResult = {
  available: boolean;
  imageUrl?: string;
  message?: string;
};

export type TryOnInput = {
  personImageUrl: string;
  garmentImageUrl: string;
  category?: string;
};

export interface TryOnProvider {
  readonly name: string;
  isConfigured(): boolean;
  runTryOn(input: TryOnInput): Promise<TryOnResult>;
}
