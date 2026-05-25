import {
  generateFashionBoard,
  isAzureImageGenerationConfigured,
} from "@/lib/azure/images";
import type { GenerateBoardInput, ImageProvider } from "./types";

export const azureImageProvider: ImageProvider = {
  name: "azure",
  isConfigured: isAzureImageGenerationConfigured,
  generateBoard: ({ prompt, quality, referenceImageUrl, productImageUrls }) =>
    generateFashionBoard(
      prompt,
      quality ?? "hd",
      referenceImageUrl,
      productImageUrls
    ),
};
