import { OutfitCategory } from "@prisma/client";
import { getChatClient } from "@/lib/azure/openai";

/**
 * GPT-4o vision classifier for a single wardrobe-item photo.
 *
 * Returns one of the seven `OutfitCategory` enum values. We keep the prompt
 * tight and the output space constrained to a single token so this stays
 * cheap (~$0.001/call) and fast (≈1.5–3 s end-to-end).
 *
 * Failure modes (no Azure key, network error, malformed response) all fall
 * back to `OutfitCategory.OTHER` so a classifier outage never blocks an
 * upload — the user can always re-tag manually via `ItemTagEditor`.
 */

const VALID_LABELS = [
  "TOP",
  "BOTTOM",
  "DRESS",
  "OUTERWEAR",
  "FOOTWEAR",
  "ACCESSORY",
  "OTHER",
] as const;

type ClassificationLabel = (typeof VALID_LABELS)[number];

const SYSTEM_PROMPT = `You are a fashion item classifier. Look at the photo and decide which single category best describes the primary garment or item shown.

You MUST reply with EXACTLY ONE WORD, chosen from this list (uppercase, no punctuation, no explanation):

TOP        — shirts, t-shirts, blouses, sweaters, hoodies, polos, tank tops, bodysuits
BOTTOM     — jeans, trousers, pants, shorts, skirts, joggers, leggings, cargo pants
DRESS      — dresses, gowns, jumpsuits, rompers, sarees, kurtas (full-body single piece)
OUTERWEAR  — jackets, blazers, coats, overcoats, trench coats, parkas, vests
FOOTWEAR   — shoes, sneakers, loafers, boots, sandals, heels, slippers
ACCESSORY  — belts, bags, hats, caps, sunglasses, watches, scarves, jewelry, ties
OTHER      — only if the item genuinely does not fit any category above

Rules:
- If multiple items appear (e.g. a model wearing a full outfit), classify the MOST PROMINENT or central garment.
- If a top is tucked into a bottom and both are visible, choose whichever fills more of the frame.
- Never invent a new label. Never add quotes or punctuation. Reply with the single uppercase word and nothing else.`;

function isValidLabel(s: string): s is ClassificationLabel {
  return (VALID_LABELS as readonly string[]).includes(s);
}

function labelToEnum(label: ClassificationLabel): OutfitCategory {
  switch (label) {
    case "TOP":
      return OutfitCategory.TOP;
    case "BOTTOM":
      return OutfitCategory.BOTTOM;
    case "DRESS":
      return OutfitCategory.DRESS;
    case "OUTERWEAR":
      return OutfitCategory.OUTERWEAR;
    case "FOOTWEAR":
      return OutfitCategory.FOOTWEAR;
    case "ACCESSORY":
      return OutfitCategory.ACCESSORY;
    case "OTHER":
      return OutfitCategory.OTHER;
  }
}

const CLASSIFY_TIMEOUT_MS = 15_000;

export async function classifyGarment(
  imageUrl: string
): Promise<OutfitCategory> {
  if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY) {
    return OutfitCategory.OTHER;
  }

  try {
    const client = getChatClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O ?? "gpt-4o";

    const completion = await client.chat.completions.create(
      {
        model: deployment,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Classify this clothing/accessory item.",
              },
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "low" },
              },
            ],
          },
        ],
        // One-token-ish reply; deterministic.
        max_tokens: 8,
        temperature: 0,
      },
      { timeout: CLASSIFY_TIMEOUT_MS }
    );

    const raw = completion.choices[0]?.message?.content?.trim().toUpperCase();
    if (!raw) return OutfitCategory.OTHER;

    // The model usually returns just the label, but be defensive: take the
    // first token-like substring and validate.
    const token = raw.split(/[^A-Z]+/).find(Boolean) ?? "";
    if (isValidLabel(token)) return labelToEnum(token);

    return OutfitCategory.OTHER;
  } catch (e) {
    console.warn("classifyGarment failed:", e);
    return OutfitCategory.OTHER;
  }
}

const DESCRIBE_SYSTEM = `You are a fashion catalogue copywriter. Look at the photo and produce ONE short description of the primary garment shown — the kind of phrase a shopping site would put under the product title.

Rules:
- 4 to 9 words.
- Lower case, no quotes, no trailing period.
- Order: colour(s), pattern (if any), fabric or fit, garment noun.
- Examples: "white short-sleeve cotton tee", "olive green cargo pants", "black-and-white striped linen shirt", "tan leather chelsea boots".
- If multiple items appear, describe the MOST PROMINENT garment.
- Never include the brand name, never mention the model, never describe the background.

Reply with the phrase and nothing else.`;

/**
 * Generates a short, fashion-catalogue style description for a wardrobe
 * item photo. Returns an empty string when Azure OpenAI isn't configured or
 * the call fails — callers should fall back to a category-based label.
 *
 * Cost: ≈$0.001 per image, ≈2–3 s end-to-end. Cheap enough to call once at
 * upload time and (lazily) backfill at generation time for legacy items.
 */
export async function describeGarment(imageUrl: string): Promise<string> {
  if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY) {
    return "";
  }
  try {
    const client = getChatClient();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_GPT4O ?? "gpt-4o";
    const completion = await client.chat.completions.create(
      {
        model: deployment,
        messages: [
          { role: "system", content: DESCRIBE_SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this garment in one short phrase." },
              { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            ],
          },
        ],
        max_tokens: 32,
        temperature: 0.2,
      },
      { timeout: CLASSIFY_TIMEOUT_MS }
    );
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    // Strip surrounding quotes, trailing period, and collapse whitespace.
    return raw
      .replace(/^["'`\s]+|["'`\s.]+$/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
  } catch (e) {
    console.warn("describeGarment failed:", e);
    return "";
  }
}
