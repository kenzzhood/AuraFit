import type { FashionBoardImage, GenerateBoardInput, ImageProvider } from "./types";

export const noopImageProvider: ImageProvider = {
  name: "noop",
  isConfigured: () => true,
  async generateBoard(_input: GenerateBoardInput): Promise<FashionBoardImage> {
    return {};
  },
};
