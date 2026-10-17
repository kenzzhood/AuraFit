import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/api/require-user";
import { rateLimitedResponse } from "@/lib/api/rate-limit-response";
import { MEDIA_PRODUCT_RATE_LIMIT, rateLimit } from "@/lib/redis";
import { safeFetch, UnsafeUrlError } from "@/lib/security/ssrf";
import {
  assertProductProxyUrl,
  isAllowedProductProxyContentType,
  MAX_PRODUCT_PROXY_BYTES,
  PRODUCT_IMAGE_USER_AGENT,
} from "@/lib/media/product-proxy";

export const runtime = "nodejs";

function hostnameOnly(raw: string): string {
  try {
    return new URL(raw).hostname;
  } catch {
    return "invalid";
  }
}

export async function GET(req: Request) {
  const authz = await requireAppUser();
  if (!authz.ok) return authz.response;
  const user = authz.user;

  const lim = await rateLimit(
    `media-product:${user.id}`,
    MEDIA_PRODUCT_RATE_LIMIT.limit,
    MEDIA_PRODUCT_RATE_LIMIT.windowSec
  );
  if (!lim.ok) {
    return rateLimitedResponse("media", lim.retryAfterSec);
  }

  const raw = new URL(req.url).searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  let target: URL;
  try {
    target = assertProductProxyUrl(raw);
  } catch (e) {
    if (e instanceof UnsafeUrlError) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    const upstream = await safeFetch(target.toString(), {
      headers: {
        "User-Agent": PRODUCT_IMAGE_USER_AGENT,
        Accept: "image/*",
      },
      signal: AbortSignal.timeout(8_000),
      maxRedirects: 3,
    });
    if (!upstream.ok) {
      console.warn(
        `[media/product] fetch failed host=${hostnameOnly(target.toString())} status=${upstream.status}`
      );
      return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!isAllowedProductProxyContentType(contentType)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }

    const declared = Number(upstream.headers.get("content-length") ?? "0");
    if (declared > MAX_PRODUCT_PROXY_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const reader = upstream.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_PRODUCT_PROXY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return NextResponse.json({ error: "Image too large" }, { status: 413 });
      }
      chunks.push(value);
    }

    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const mime = contentType.split(";")[0]!.trim().toLowerCase();
    const normalized = mime === "image/jpg" ? "image/jpeg" : mime;

    return new NextResponse(body, {
      headers: {
        "Content-Type": normalized,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    if (e instanceof UnsafeUrlError) {
      return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }
    console.warn(
      `[media/product] fetch error host=${hostnameOnly(target.toString())}`
    );
    return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
  }
}
