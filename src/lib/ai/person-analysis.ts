import { analyzePersonWithFallback } from "@/lib/ai/provider";
import type { PersonAnalysis } from "@/types/generation";

export type { PersonAnalysis };

export async function analyzePersonPhoto(
  imageUrl: string
): Promise<PersonAnalysis | null> {
  try {
    const { value } = await analyzePersonWithFallback({ imageUrl });
    return value;
  } catch (e) {
    console.warn("Person photo analysis failed:", e);
    return null;
  }
}

/**
 * Converts a PersonAnalysis into the dense identity-lock block used in image
 * generation prompts. Modeled after proven reference prompts that keep facial
 * identity consistent across multi-panel fashion boards.
 */
export function personAnalysisToPromptBlock(
  analysis: PersonAnalysis | null
): string {
  if (!analysis) {
    return [
      "A real person photographed in natural light.",
      "IDENTITY LOCK: Preserve 100% of facial structure, skin tone, skin texture, hair, and body proportions.",
      "NO beautification. NO symmetry edits. NO identity drift. NO plastic skin. NO AI face.",
      "Render as a real human being with natural skin pores, realistic hair strands, and authentic facial anatomy.",
    ].join(" ");
  }

  const lines: string[] = [];

  // Core identity paragraph
  if (analysis.identityNotes) {
    lines.push(analysis.identityNotes);
  }

  // Precise physical description block
  const physical: string[] = [];
  if (analysis.genderPresentation) physical.push(analysis.genderPresentation);
  if (analysis.ageRange) physical.push(`approximately ${analysis.ageRange} years old`);
  if (analysis.heightEstimate) physical.push(`height ${analysis.heightEstimate}`);
  if (analysis.bodyBuild) physical.push(`${analysis.bodyBuild} physique`);
  if (analysis.shoulderWidth) physical.push(`${analysis.shoulderWidth} shoulders`);
  if (physical.length) lines.push(physical.join(", ") + ".");

  // Skin
  const skinParts: string[] = [];
  if (analysis.skinTone) skinParts.push(analysis.skinTone);
  if (analysis.undertones) skinParts.push(`${analysis.undertones} undertones`);
  if (analysis.skinTextureNotes) skinParts.push(analysis.skinTextureNotes);
  if (skinParts.length) lines.push(`Skin: ${skinParts.join(", ")}.`);

  // Face anatomy
  if (analysis.faceShape || analysis.faceAnatomyNotes) {
    const faceParts = [analysis.faceShape, analysis.faceAnatomyNotes].filter(Boolean);
    lines.push(`Face: ${faceParts.join(". ")}.`);
  }

  // Eyes
  if (analysis.eyeDescription) {
    lines.push(`Eyes: ${analysis.eyeDescription}.`);
  }

  // Hair
  const hairParts: string[] = [];
  if (analysis.hairColor) hairParts.push(analysis.hairColor);
  if (analysis.hairType) hairParts.push(analysis.hairType);
  if (analysis.hairstyle) hairParts.push(analysis.hairstyle);
  if (hairParts.length) lines.push(`Hair: ${hairParts.join(", ")}.`);

  // Distinctive features (glasses, beard, moles, etc.)
  if (analysis.distinctiveFeatures) {
    lines.push(`Distinctive features: ${analysis.distinctiveFeatures}.`);
  }

  // Identity lock rules
  lines.push(
    "CRITICAL IDENTITY RULES — must be followed in every single panel:",
    "• Use this person as the absolute identity source. Keep the face 1:1 identical with no changes to facial structure, skin texture, skin tone, eyes, or expression.",
    "• No beautification, smoothing, symmetry edits, or identity drift.",
    "• Preserve exact hair color, tone, and style.",
    "• Visible skin pores, fine natural details, realistic sweat sheen if present — render as a real human, not AI-generated.",
    "• If anything conflicts with the description, always preserve identity first."
  );

  return lines.join("\n");
}
