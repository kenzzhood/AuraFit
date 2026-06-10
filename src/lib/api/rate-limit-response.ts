import { NextResponse } from "next/server";

export function rateLimitedResponse(
  label: string,
  retryAfterSec: number
): NextResponse {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
  return NextResponse.json(
    {
      error: `Too many ${label} requests. Try again in about ${mins} minute${mins === 1 ? "" : "s"}.`,
      retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}

export function generationRateLimitedResponse(
  retryAfterSec: number
): NextResponse {
  return rateLimitedResponse("generation", retryAfterSec);
}
