import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai/provider";

export async function embedText(text: string): Promise<number[]> {
  const vec = await getAIProvider().generateEmbeddings(text.slice(0, 8000));
  if (!vec.length) throw new Error("No embedding returned");
  return vec;
}

/**
 * Upsert pgvector row (Prisma marks `embedding` as Unsupported).
 */
export async function upsertFashionEmbeddingRow(
  wardrobeItemId: string,
  vector: number[]
): Promise<void> {
  const id = nanoid();
  const literal = `[${vector.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "FashionEmbedding" ("id","wardrobeItemId","modelVersion","embedding")
     VALUES ($1::text, $2::text, $3::text, $4::vector)
     ON CONFLICT ("wardrobeItemId") DO UPDATE SET
       "embedding" = EXCLUDED."embedding",
       "modelVersion" = EXCLUDED."modelVersion"`,
    id,
    wardrobeItemId,
    "text-embedding-3-large",
    literal
  );
}
