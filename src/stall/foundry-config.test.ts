import { describe, expect, it } from "vitest";
import { foundryDeploymentBase, readFoundryConfig } from "@/stall/foundry-config";
import { characterLookPrompt, styleTryOnPrompt } from "@/stall/prompts";
import type { CatalogItem } from "@/stall/types";

describe("foundry config", () => {
  it("stays in demo mode when the example placeholders are copied", () => {
    const config = readFoundryConfig({
      AZURE_FOUNDRY_ENDPOINT: "https://YOUR_RESOURCE.openai.azure.com",
      AZURE_FOUNDRY_API_KEY: "",
      AZURE_FOUNDRY_IMAGE_DEPLOYMENT: "gpt-image-1",
    });
    expect(config.live).toBe(false);
  });

  it("turns live mode on when endpoint, key and deployment are set", () => {
    const config = readFoundryConfig({
      AZURE_FOUNDRY_ENDPOINT: "https://autofit.openai.azure.com/",
      AZURE_FOUNDRY_API_KEY: "test-key",
      AZURE_FOUNDRY_IMAGE_DEPLOYMENT: "gpt-image-1",
    });
    expect(config.live).toBe(true);
    expect(config.apiVersion).toBe("2025-04-01-preview");
    expect(foundryDeploymentBase(config.endpoint!, config.deployment!)).toBe(
      "https://autofit.openai.azure.com/openai/deployments/gpt-image-1"
    );
  });

  it("can be forced back to demo", () => {
    const config = readFoundryConfig({
      AZURE_FOUNDRY_ENDPOINT: "https://autofit.services.ai.azure.com",
      AZURE_FOUNDRY_API_KEY: "test-key",
      AZURE_FOUNDRY_IMAGE_DEPLOYMENT: "gpt-image-1",
      AUTOFIT_FORCE_DEMO: "true",
    });
    expect(config.live).toBe(false);
  });

  it("strips a full edits URL down to the deployment base", () => {
    expect(
      foundryDeploymentBase(
        "https://autofit.cognitiveservices.azure.com/openai/deployments/gpt-image-1/images/edits?api-version=2025-04-01-preview",
        "gpt-image-1"
      )
    ).toBe(
      "https://autofit.cognitiveservices.azure.com/openai/deployments/gpt-image-1"
    );
  });
});

describe("prompts", () => {
  const dress: CatalogItem = {
    id: "myntra-1",
    title: "Red floral midi dress",
    brand: "anayna",
    priceInr: 890,
    mrpInr: 2698,
    url: "https://www.myntra.com/ethnic-dresses/example/buy",
    image: "/catalog/images/myntra-1.jpg",
    store: "myntra",
    category: "dresses",
    gender: "women",
    accessoryType: null,
    color: "Red",
    style: "party",
  };

  it("keeps identity and garment fidelity in both modes", () => {
    const style = styleTryOnPrompt([dress]);
    const character = characterLookPrompt({
      id: "eren-yeager",
      name: "Eren Yeager",
      series: "Attack on Titan",
      look: "short brown undercut and Survey Corps jacket",
      hair: "short brown undercut",
      image: "/characters/anime/eren-yeager.jpg",
      group: "anime",
    });
    expect(style).toContain("Preserve the visitor's face");
    expect(style).toContain("skin tone");
    expect(style).toContain("body shape");
    expect(style).toContain("Red floral midi dress");
    expect(character).toContain("Reference image 2");
    expect(character).toContain("hairstyle");
    expect(character).toContain("Eren Yeager");
    expect(character).toContain("still be the visitor");
  });
});
