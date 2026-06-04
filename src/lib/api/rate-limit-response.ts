import { NextResponse } from "next/server";

export function generationRateLimitedResponse(
  retryAfterSec: number
): NextResponse {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
  return NextResponse.json(
    {
      error: `Too many generation requests. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`,
      retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}
