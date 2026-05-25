/**
 * Standardised API error responses.
 *
 * Use these helpers in every API route instead of ad-hoc NextResponse.json({ error: ... }).
 * They:
 *  - Never expose stack traces or internal error messages to clients
 *  - Always include a requestId for correlation with server logs
 *  - Use consistent JSON shape: { error, code, requestId }
 */
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "STORAGE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

export type ApiErrorResponse = {
  error: string;
  code: ApiErrorCode;
  requestId: string;
};

function makeRequestId() {
  return nanoid(12);
}

export function apiError(
  message: string,
  code: ApiErrorCode,
  status: number,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: message, code, requestId: requestId ?? makeRequestId() },
    { status }
  );
}

// Convenience helpers
export const unauthorized = (msg = "Unauthorized") =>
  apiError(msg, "UNAUTHORIZED", 401);

export const forbidden = (msg = "Forbidden") =>
  apiError(msg, "FORBIDDEN", 403);

export const notFound = (msg = "Not found") =>
  apiError(msg, "NOT_FOUND", 404);

export const validationError = (msg: string) =>
  apiError(msg, "VALIDATION_ERROR", 400);

export const rateLimited = (msg = "Too many requests. Please slow down.") =>
  apiError(msg, "RATE_LIMITED", 429);

export const fileTooLarge = (msg = "File too large.") =>
  apiError(msg, "FILE_TOO_LARGE", 413);

export const invalidFileType = (msg = "Invalid file type.") =>
  apiError(msg, "INVALID_FILE_TYPE", 415);

export const storageUnavailable = (msg = "Storage service unavailable.") =>
  apiError(msg, "STORAGE_UNAVAILABLE", 503);

export const internalError = (
  err: unknown,
  requestId?: string
): NextResponse<ApiErrorResponse> => {
  // Log the real error server-side
  if (process.env.NODE_ENV !== "test") {
    console.error(
      `[API] Internal error${requestId ? ` (${requestId})` : ""}:`,
      err instanceof Error ? err.message : err
    );
  }
  // Never expose internal details to the client
  return apiError("An unexpected error occurred.", "INTERNAL_ERROR", 500, requestId);
};
