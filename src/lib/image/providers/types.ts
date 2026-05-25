export type FashionBoardImage = {
  url?: string;
  buffer?: Buffer;
};

export type GenerateBoardInput = {
  prompt: string;
  quality?: "preview" | "medium" | "hd";
  /**
   * Optional URL of the user's reference photo. When supplied AND the
   * underlying provider supports image-to-image editing (e.g. Azure
   * gpt-image-*), this image is sent to /images/edits so the generated
   * board preserves the subject's face/identity instead of inventing a
   * generic one from text alone.
   */
  referenceImageUrl?: string;
  /**
   * Optional URLs of real product thumbnails to feed as additional reference
   * images. When the provider supports multi-image edits, these become
   * Image 2..N in the edit call and the prompt references them by index so
   * each generated outfit panel uses garments actually available in stores.
   */
  productImageUrls?: string[];
};

export interface ImageProvider {
  readonly name: string;
  isConfigured(): boolean;
  generateBoard(input: GenerateBoardInput): Promise<FashionBoardImage>;
}
