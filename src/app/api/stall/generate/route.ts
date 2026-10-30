import { NextResponse } from "next/server";
import { z } from "zod";
import { APP_DISPLAY_NAME } from "@/stall/brand";
import { loadCatalog, loadCharacters, safePublicImage } from "@/stall/catalog-store";
import { renderDemoBoard } from "@/stall/demo-board";
import { readFoundryConfig } from "@/stall/foundry-config";
import { editWithFoundry, readImageFile } from "@/stall/foundry-image";
import { characterLookPrompt, styleTryOnPrompt } from "@/stall/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  mode: z.enum(["style", "character"]),
  photo: z.string().max(8_000_000),
  productIds: z.array(z.string().max(80)).max(8).optional(),
  characterId: z.string().max(80).optional(),
});

function decodePhoto(dataUrl: string): Buffer {
  const match = /^data:image\/(?:jpeg|jpg|png|webp);base64,([a-z0-9+/=\s]+)$/i.exec(
    dataUrl.trim()
  );
  if (!match) throw new Error("Use a photo from the camera");
  const buffer = Buffer.from(match[1], "base64");
  if (buffer.length < 800 || buffer.length > 6_000_000) {
    throw new Error("That photo is too small or too large");
  }
  return buffer;
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Image generation failed";
  return message.replace(/\b[A-Za-z0-9_\-]{24,}\b/g, "…").slice(0, 180);
}

export async function POST(request: Request) {
  let payload: z.infer<typeof bodySchema>;
  try {
    payload = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Could not read that request" }, { status: 400 });
  }

  let photo: Buffer;
  try {
    photo = decodePhoto(payload.photo);
  } catch (error) {
    return NextResponse.json({ error: publicError(error) }, { status: 400 });
  }

  const products = (payload.productIds ?? [])
    .map((id) => loadCatalog().items.find((item) => item.id === id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 6);
  const character =
    loadCharacters().items.find((item) => item.id === payload.characterId) ?? null;

  if (payload.mode === "style" && products.length === 0) {
    return NextResponse.json({ error: "Add at least one piece first" }, { status: 400 });
  }
  if (payload.mode === "character" && !character) {
    return NextResponse.json({ error: "Choose a character first" }, { status: 400 });
  }

  const tiles: { buffer: Buffer; label: string }[] = [];
  const sources =
    payload.mode === "character" && character
      ? [{ image: character.image, label: character.name }]
      : products.map((product) => ({ image: product.image, label: product.title }));
  for (const source of sources) {
    const file = safePublicImage(source.image);
    if (!file) continue;
    tiles.push({ buffer: readImageFile(file), label: source.label });
  }

  const heading =
    payload.mode === "character" && character ? character.name : APP_DISPLAY_NAME;
  const subheading =
    payload.mode === "character" && character
      ? character.series
      : "Styled from the cart";

  const demo = async () => {
    const image = await renderDemoBoard({
      photo,
      heading,
      subheading,
      tiles: tiles.map((tile) => ({ image: tile.buffer, label: tile.label })),
    });
    return `data:image/jpeg;base64,${image.toString("base64")}`;
  };

  const config = readFoundryConfig();
  if (!config.live) {
    try {
      return NextResponse.json({ mode: "demo", image: await demo() });
    } catch (error) {
      return NextResponse.json({ error: publicError(error) }, { status: 500 });
    }
  }

  try {
    const prompt =
      payload.mode === "character" && character
        ? characterLookPrompt(character)
        : styleTryOnPrompt(products);
    const edited = await editWithFoundry({
      config,
      photo,
      references: tiles.map((tile) => tile.buffer),
      prompt,
    });
    const mime = edited[0] === 0xff ? "image/jpeg" : "image/png";
    return NextResponse.json({
      mode: "live",
      image: `data:${mime};base64,${edited.toString("base64")}`,
    });
  } catch (error) {
    try {
      return NextResponse.json({
        mode: "demo",
        image: await demo(),
        error: `Live model did not respond. Showing a demo preview. ${publicError(error)}`,
      });
    } catch {
      return NextResponse.json({ error: publicError(error) }, { status: 502 });
    }
  }
}
