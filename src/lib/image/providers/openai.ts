import type { FashionBoardImage, ImageProvider } from "./types";

function isConfigured(): boolean {
  return false;
}

export const openaiImageProvider: ImageProvider = {
  name: "openai",
  isConfigured,
  async generateBoard(): Promise<FashionBoardImage> {
    throw new Error(
      "Direct OpenAI image calls are disabled. Set AURAFIT_IMAGE_MODEL and the Azure OpenAI endpoint."
    );
  },
};
