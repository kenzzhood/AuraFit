import fs from "node:fs";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import {
  foundryDeploymentBase,
  readFoundryConfig,
  type FoundryConfig,
} from "@/stall/foundry-config";

async function asJpeg(source: Buffer): Promise<Buffer> {
  return sharp(source).rotate().jpeg({ quality: 88 }).toBuffer();
}

export async function editWithFoundry(input: {
  config?: FoundryConfig;
  photo: Buffer;
  references: Buffer[];
  prompt: string;
}): Promise<Buffer> {
  const config = input.config ?? readFoundryConfig();
  if (!config.live || !config.endpoint || !config.apiKey || !config.deployment) {
    throw new Error("Azure AI Foundry is not configured");
  }
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: foundryDeploymentBase(config.endpoint, config.deployment),
    defaultQuery: { "api-version": config.apiVersion },
    defaultHeaders: { "api-key": config.apiKey },
  });
  const photo = await toFile(await asJpeg(input.photo), "visitor.jpg", {
    type: "image/jpeg",
  });
  const refs = await Promise.all(
    input.references.slice(0, 4).map(async (buf, index) =>
      toFile(await asJpeg(buf), `ref-${index + 1}.jpg`, { type: "image/jpeg" })
    )
  );
  const images = [photo, ...refs];
  const attempt = () =>
    client.images.edit(
      {
        model: config.deployment!,
        prompt: input.prompt,
        image: images as unknown as Parameters<typeof client.images.edit>[0]["image"],
        n: 1,
        size: "1536x1024",
        quality: "medium",
      },
      { timeout: 90_000 }
    );

  let response;
  try {
    response = await attempt();
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    response = await attempt();
  }
  const first = response.data?.[0];
  if (first?.b64_json) return Buffer.from(first.b64_json, "base64");
  if (first?.url) {
    const fetched = await fetch(first.url);
    if (!fetched.ok) throw new Error("Foundry image URL could not be downloaded");
    return Buffer.from(await fetched.arrayBuffer());
  }
  throw new Error("Foundry returned no image");
}

export function readImageFile(file: string): Buffer {
  return fs.readFileSync(file);
}
