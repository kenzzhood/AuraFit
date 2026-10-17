import { NextResponse } from "next/server";

const ALLOWED_ORIGINS =
  process.env.CORS_ALLOWED_ORIGINS?.split(",").map((s) => s.trim()) ?? [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
    "exp://127.0.0.1:8081",
  ];

export function corsHeaders(origin: string | null): HeadersInit {
  // Never support wildcard reflection — exact allowlist match only.
  const matched =
    origin &&
    ALLOWED_ORIGINS.some((o) => o !== "*" && origin === o)
      ? origin
      : null;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (matched) {
    headers["Access-Control-Allow-Origin"] = matched;
    headers.Vary = "Origin";
  }
  return headers;
}

export function withCors(response: NextResponse, origin: string | null) {
  const headers = corsHeaders(origin);
  Object.entries(headers).forEach(([k, v]) => {
    response.headers.set(k, v);
  });
  return response;
}

export function optionsResponse(origin: string | null) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
