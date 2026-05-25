import type { TryOnInput, TryOnProvider, TryOnResult } from "./types";

const REPLICATE_MODEL =
  process.env.REPLICATE_TRYON_MODEL ?? "cuuupid/idm-vton-slim";

function isConfigured(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}

async function pollReplicateOutput(
  getUrl: string,
  token: string,
  maxWaitMs = 120_000
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const r = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as {
      status: string;
      output?: unknown;
      error?: string;
    };
    if (j.status === "succeeded") {
      const out = j.output;
      if (typeof out === "string") return out;
      if (Array.isArray(out) && typeof out[0] === "string") return out[0];
      return null;
    }
    if (j.status === "failed" || j.status === "canceled") return null;
    await new Promise((res) => setTimeout(res, 1500));
  }
  return null;
}

export const replicateTryOnProvider: TryOnProvider = {
  name: "replicate",
  isConfigured,
  async runTryOn(input: TryOnInput): Promise<TryOnResult> {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) throw new Error("REPLICATE_API_TOKEN not set");

    const parts = REPLICATE_MODEL.split("/");
    if (parts.length !== 2) throw new Error("Invalid REPLICATE_TRYON_MODEL");
    const [owner, nameModel] = parts;

    const createRes = await fetch(
      `https://api.replicate.com/v1/models/${owner}/${nameModel}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            human_img: input.personImageUrl,
            garm_img: input.garmentImageUrl,
            category: input.category ?? "upper_body",
          },
        }),
      }
    );

    if (!createRes.ok) {
      throw new Error(`Replicate try-on create failed: ${await createRes.text()}`);
    }

    const created = (await createRes.json()) as { urls?: { get?: string } };
    const getUrl = created.urls?.get;
    if (!getUrl) throw new Error("Replicate try-on missing poll URL");

    const imageUrl = await pollReplicateOutput(getUrl, token);
    if (!imageUrl) throw new Error("Try-on timed out or failed");

    return { available: true, imageUrl };
  },
};
