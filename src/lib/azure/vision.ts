/**
 * Azure AI Vision — Analyze Image (tags, colors, caption).
 * Endpoint format: https://<resource>.cognitiveservices.azure.com/
 */
export async function analyzeFashionImage(imageUrlOrBase64: string): Promise<{
  caption?: string;
  tags: string[];
  colors: string[];
}> {
  const endpoint = process.env.AZURE_VISION_ENDPOINT?.replace(/\/$/, "");
  const key = process.env.AZURE_VISION_API_KEY;
  if (!endpoint || !key) {
    return { tags: [], colors: [], caption: undefined };
  }

  const url = `${endpoint}/computervision/imageanalysis:analyze`;
  const params = new URLSearchParams({
    features: "caption,tags",
    "api-version": "2023-10-01",
  });

  const isDataUrl = imageUrlOrBase64.startsWith("data:");
  const body = isDataUrl
    ? Buffer.from(imageUrlOrBase64.split(",")[1] ?? "", "base64")
    : JSON.stringify({ url: imageUrlOrBase64 });

  const res = await fetch(`${url}?${params}`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      ...(isDataUrl
        ? { "Content-Type": "application/octet-stream" }
        : { "Content-Type": "application/json" }),
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Vision API error:", res.status, text);
    return { tags: [], colors: [] };
  }

  const data = (await res.json()) as {
    captionResult?: { text?: string };
    tagsResult?: { values?: Array<{ name?: string }> };
  };

  const tags =
    data.tagsResult?.values?.map((v) => v.name).filter(Boolean) as string[];
  return {
    caption: data.captionResult?.text,
    tags: tags ?? [],
    colors: [],
  };
}
