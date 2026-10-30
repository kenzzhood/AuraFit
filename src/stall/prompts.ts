import type { CatalogItem, CharacterItem } from "@/stall/types";

/**
 * Image prompts for the IGDC stall.
 * Find my look (price, occasion, six outfits) was removed and has no prompt.
 */

function garmentLine(item: CatalogItem, index: number): string {
  const slot =
    item.category === "tops"
      ? "top"
      : item.category === "bottoms"
        ? "bottoms"
        : item.category === "dresses"
          ? "dress"
          : item.category === "coats"
            ? "jacket"
            : item.accessoryType ?? "accessory";
  const color = item.color ? `, colour ${item.color}` : "";
  return `Reference image ${index + 2} is the ${slot}: "${item.title}"${color}. Reproduce that item's colour, pattern, texture and cut. Do not redesign it.`;
}

export function styleTryOnPrompt(items: CatalogItem[]): string {
  const lines = items.map(garmentLine).join("\n");
  return [
    "Edit the person in reference image 1 into one photorealistic full-body fashion photograph.",
    "Preserve the visitor's face and identity exactly: same facial structure, eyes, skin tone, age and distinguishing features. Preserve their body shape and proportions. Do not beautify, slim, age, or replace them with a model.",
    "Dress them only in the referenced items. Keep each garment faithful.",
    lines,
    "Photoreal lighting, natural shadows, sharp fabric detail, head-to-toe framing with the whole outfit visible, plain warm studio background.",
    "No text, watermark, extra people, extra garments, or distorted hands.",
  ].join("\n");
}

export function characterLookPrompt(character: CharacterItem): string {
  return [
    `Edit the person in reference image 1 so they wear ${character.name}'s whole signature look from ${character.series}.`,
    "Reference image 2 is the character reference. Use it for the hairstyle and the outfit: copy the hair cut, colour, length and volume, and the clothing colour, pattern, cut and signature accessories.",
    "Do not copy the character's face. Preserve the visitor's face and identity exactly: same facial structure, eyes, skin tone and age. Preserve their body shape. The result must still be the visitor, not a drawing of the character and not a different person.",
    `Written backup if a detail is unclear in the reference: ${character.look}`,
    "Photoreal full-body photograph, natural skin, coherent lighting, head-to-toe framing, simple studio background.",
    "No text, watermark, extra people, or weapons.",
  ].join("\n");
}

export const PROMPT_SUMMARY = {
  style:
    "Full-body photoreal edit. Keeps the visitor's face, skin tone and body shape, and applies each referenced garment's colour, pattern and cut.",
  character:
    "Full-body photoreal edit. Keeps the visitor's face, skin tone and body shape, and transfers one character's hairstyle, outfit and signature accessories.",
} as const;
