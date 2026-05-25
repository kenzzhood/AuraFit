import { createHash } from "crypto";
import { cacheGet, cacheSet } from "@/lib/cache/provider";
import { embedText } from "@/lib/ai/embeddings";
import { prisma } from "@/lib/prisma";

const MODEL_VERSION = "text-embedding-3-large";

function embeddingCacheKey(textHash: string): string {
  return `embed:text:${textHash}`;
}

export async function getOrCreateTextEmbedding(text: string): Promise<number[]> {
  const hash = createHash("sha256").update(text).digest("hex");
  const cached = await cacheGet<number[]>(embeddingCacheKey(hash));
  if (cached?.length) return cached;

  const vec = await embedText(text);
  await cacheSet(embeddingCacheKey(hash), vec, 86400 * 7);
  return vec;
}

export async function upsertProductEmbedding(
  productIndexId: string,
  text: string,
  contentHash: string
): Promise<void> {
  const cacheKey = `embed:product:${productIndexId}:${contentHash}`;
  const cached = await cacheGet<number[]>(cacheKey);
  let vector: number[];

  if (cached?.length) {
    vector = cached;
  } else {
    vector = await getOrCreateTextEmbedding(text.slice(0, 8000));
    await cacheSet(cacheKey, vector, 86400 * 30);
  }

  const literal = `[${vector.join(",")}]`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProductEmbedding" ("id", "productIndexId", "modelVersion", "embedding")
     VALUES ($1::text, $2::text, $3::text, $4::vector)
     ON CONFLICT ("productIndexId") DO UPDATE SET
       "embedding" = EXCLUDED."embedding",
       "modelVersion" = EXCLUDED."modelVersion"`,
    `pe_${productIndexId}`,
    productIndexId,
    MODEL_VERSION,
    literal
  );
}

export async function searchProductsByVector(params: {
  vector: number[];
  region: string;
  limit?: number;
  minScore?: number;
}): Promise<Array<{ productIndexId: string; score: number }>> {
  const limit = params.limit ?? 12;
  const literal = `[${params.vector.join(",")}]`;

  const rows = await prisma.$queryRawUnsafe<
    Array<{ productIndexId: string; score: number }>
  >(
    `SELECT pe."productIndexId",
            1 - (pe.embedding <=> $1::vector) AS score
     FROM "ProductEmbedding" pe
     INNER JOIN "ProductIndex" pi ON pi.id = pe."productIndexId"
     WHERE pi.region = $2
     ORDER BY pe.embedding <=> $1::vector
     LIMIT $3`,
    literal,
    params.region,
    limit
  );

  const minScore = params.minScore ?? Number(process.env.PRODUCT_INDEX_MIN_SCORE ?? 0.55);
  return rows.filter((r) => r.score >= minScore);
}
