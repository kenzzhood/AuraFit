import { z } from "zod";

const schema = z.object({
  AURAFIT_IMAGE_PROVIDER: z.enum(["mock", "azure"]).default("mock"),
  AURAFIT_IMAGE_MODEL: z.string().min(1).default("gpt-image-2.5-sunburst"),
  AURAFIT_DB: z.enum(["pglite", "postgres"]).default("pglite"),
  AURAFIT_BLOB: z.enum(["local", "azure"]).default("local"),
  AURAFIT_AUTH: z.enum(["mock", "entra"]).optional(),
  AURAFIT_WHATSAPP: z.enum(["mock", "meta"]).default("mock"),
  AURAFIT_GESTURE: z.enum(["sim", "mediapipe"]).default("sim"),
});

export type AppConfig = z.infer<typeof schema>;

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return schema.parse({
    AURAFIT_IMAGE_PROVIDER: env.AURAFIT_IMAGE_PROVIDER,
    AURAFIT_IMAGE_MODEL: env.AURAFIT_IMAGE_MODEL,
    AURAFIT_DB: env.AURAFIT_DB,
    AURAFIT_BLOB: env.AURAFIT_BLOB,
    AURAFIT_AUTH: env.AURAFIT_AUTH,
    AURAFIT_WHATSAPP: env.AURAFIT_WHATSAPP,
    AURAFIT_GESTURE: env.AURAFIT_GESTURE,
  });
}
