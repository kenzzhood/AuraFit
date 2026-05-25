import { API_URL } from "@/config/env";
import type {
  GenerateInput,
  GenerationJobStatus,
} from "@/api/types";

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter = async () => null;

export function setApiTokenGetter(getter: TokenGetter) {
  tokenGetter = getter;
}

const REQUEST_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 800;

/** Returns true for errors that are safe to retry. */
function isRetryable(status: number): boolean {
  // 429 = rate limited (retry after backoff), 5xx = server error
  return status === 429 || (status >= 500 && status < 600);
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  retries = MAX_RETRIES
): Promise<T> {
  const token = await tokenGetter();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof data === "object" && data && "error" in data
            ? String((data as { error: unknown }).error)
            : `Request failed (${res.status})`;

        if (isRetryable(res.status) && attempt < retries) {
          const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
          lastError = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }

      return data as T;
    } catch (err) {
      clearTimeout(timeoutId);

      const isAbort =
        err instanceof Error && err.name === "AbortError";
      const isNetwork =
        err instanceof TypeError && err.message.includes("Network request failed");

      if ((isAbort || isNetwork) && attempt < retries) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        lastError = isAbort
          ? new Error("Request timed out. Please check your connection.")
          : (err as Error);
        continue;
      }

      if (isAbort) {
        throw new Error("Request timed out. Please check your connection.");
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Request failed after retries");
}

export async function uploadImage(params: {
  base64: string;
  fileName: string;
  contentType: string;
  kind: "wardrobe" | "profile" | "outfit_render";
}) {
  // Upload is large and may take longer — use a dedicated longer timeout via controller
  const token = await tokenGetter();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s for uploads

  try {
    const res = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        typeof data === "object" && data && "error" in data
          ? String((data as { error: unknown }).error)
          : `Upload failed (${res.status})`;
      throw new Error(msg);
    }
    return data as { path: string; url: string };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Upload timed out. Please try again on a faster connection.");
    }
    throw err;
  }
}

export async function startGeneration(input: GenerateInput) {
  return apiFetch<{ jobId: string }>("/api/generate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getGenerationStatus(jobId: string) {
  return apiFetch<GenerationJobStatus>(`/api/generate/status/${jobId}`, {
    // Status polling: no retry — stale results are fine, we'll poll again
  }, 0);
}

export async function cancelGeneration(jobId: string) {
  return apiFetch<{ ok: boolean }>(`/api/generate/status/${jobId}/cancel`, {
    method: "POST",
  }, 1); // One retry for cancel
}

export async function requestHdRender(params: {
  jobId: string;
  lookIndex: number;
  userPhotoUrl?: string;
}) {
  return apiFetch<{ jobId: string }>("/api/generate/hd", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function saveOutfit(params: {
  name: string;
  occasion?: string;
  snapshot: object;
}) {
  return apiFetch<{ id: string }>("/api/outfits", {
    method: "POST",
    body: JSON.stringify({ ...params, isSaved: true }),
  });
}

export async function trackAffiliateClick(params: {
  targetUrl: string;
  source: string;
  outfitId?: string;
  productCacheId?: string;
}) {
  return apiFetch<{ redirectUrl: string }>("/api/affiliate", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function sendChatMessage(params: {
  message: string;
  conversationId?: string;
}) {
  const token = await tokenGetter();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Chat request failed (${res.status})`);
    }
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Chat request timed out.");
    }
    throw err;
  }
}
