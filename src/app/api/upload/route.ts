import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureAppUser } from "@/lib/user";
import { isStorageConfigured } from "@/lib/storage/provider";
import { uploadUserImage } from "@/lib/storage/user-upload";
import { rateLimit } from "@/lib/redis";

// Node runtime required for multipart parsing + Buffer magic-byte checks
export const runtime = "nodejs";
// Increase Node.js route duration limit to handle large files + cold starts
export const maxDuration = 90;

const jsonSchema = z.object({
  fileName: z.string().max(255),
  contentType: z.string(),
  kind: z.enum(["wardrobe", "profile", "outfit_render", "chat"]),
  base64: z.string().max(14_000_000, "File too large"), // ~10MB base64
});

const kindSchema = z.enum(["wardrobe", "profile", "outfit_render", "chat"]);

const MAX_BYTES = 10 * 1024 * 1024; // 10MB decoded

/** Allowed image MIME types. */
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * Detect MIME type from magic bytes — never trust client-supplied contentType alone.
 */
function detectMimeType(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return "image/png";
  }

  // WebP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }

  // HEIC/HEIF: ftyp box at offset 4
  if (buf.length >= 12) {
    const ftyp = buf.slice(4, 8).toString("ascii");
    if (ftyp === "ftyp") {
      const brand = buf.slice(8, 12).toString("ascii");
      if (
        brand.startsWith("heic") ||
        brand.startsWith("heix") ||
        brand.startsWith("mif1") ||
        brand.startsWith("msf1")
      ) {
        return "image/heic";
      }
    }
  }

  return null;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lim = await rateLimit(`upload:${userId}`, 20, 60);
  if (!lim.ok) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  // ── Parse body — accept both multipart (mobile) and JSON (web) ──────────
  let buf: Buffer;
  let fileName: string;
  let kind: z.infer<typeof kindSchema>;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    // Mobile path: file streamed directly from device, no base64 overhead
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Could not parse upload." }, { status: 400 });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const rawKind = formData.get("kind") as string | null;
    const kindParsed = kindSchema.safeParse(rawKind);
    if (!kindParsed.success) {
      return NextResponse.json({ error: "Invalid kind." }, { status: 400 });
    }
    kind = kindParsed.data;
    fileName = (formData.get("fileName") as string | null) ?? file.name ?? "upload.jpg";

    const arrayBuf = await file.arrayBuffer();
    buf = Buffer.from(arrayBuf);
  } else {
    // Web path: JSON body with base64-encoded image
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const parsed = jsonSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    buf = Buffer.from(parsed.data.base64, "base64");
    fileName = parsed.data.fileName;
    kind = parsed.data.kind;
  }

  const cu = await currentUser();
  try {
    await ensureAppUser(userId, cu?.primaryEmailAddress?.emailAddress);
  } catch (e) {
    console.error("[upload] user lookup failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "The local database is not running, so the photo could not be saved." },
      { status: 503 }
    );
  }

  // ── Shared validation ────────────────────────────────────────────────────
  if (buf.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large. Maximum 10 MB." },
      { status: 413 }
    );
  }

  const detectedMime = detectMimeType(buf);
  if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
    return NextResponse.json(
      { error: "Invalid file type. Only JPEG, PNG, WebP, and HEIC images are allowed." },
      { status: 415 }
    );
  }

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Storage not configured." },
      { status: 503 }
    );
  }

  try {
    const { path, url } = await uploadUserImage({
      clerkUserId: userId,
      kind,
      fileName: safeFileName,
      buffer: buf,
      contentType: detectedMime,
    });
    return NextResponse.json({ path, url });
  } catch (e) {
    console.error("[upload] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
