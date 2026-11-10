/**
 * Spend-capped catalogue art.
 * With no Azure key this exits 0 and leaves the committed SVG catalogue in place.
 * With a key it asks gpt-image-2.5-sunburst for at most AURAFIT_ASSET_CAP images (default 8).
 */
const cap = Number(process.env.AURAFIT_ASSET_CAP ?? 8);
const endpoint = process.env.AZURE_OPENAI_IMAGE_ENDPOINT;
const key = process.env.AZURE_OPENAI_IMAGE_API_KEY;
const model = process.env.AURAFIT_IMAGE_MODEL || "gpt-image-2.5-sunburst";

if (!endpoint || !key) {
  console.log("No Azure image key. Committed catalogue art stays in public/catalog.");
  process.exit(0);
}

console.log(`Would render up to ${cap} images with ${model}. Refusing to spend without an explicit AURAFIT_ASSET_RUN=1.`);
if (process.env.AURAFIT_ASSET_RUN !== "1") process.exit(0);

const response = await fetch(
  `${endpoint.replace(/\/$/, "")}/openai/deployments/${model}/images/generations?api-version=${process.env.AZURE_OPENAI_IMAGE_API_VERSION || "2025-04-01-preview"}`,
  {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      prompt: "A single indigo cotton kurta on a warm paper background, no person, no text.",
      size: "1024x1024",
      quality: "low",
      n: 1,
    }),
  }
);
if (!response.ok) {
  console.error(`Image request failed: ${response.status}`);
  process.exit(1);
}
console.log("One proof image returned. Commit replacements by hand after review.");
