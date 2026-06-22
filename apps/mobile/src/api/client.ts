import * as FileSystem from "expo-file-system";
import { API_URL } from "../config/env";
import {
  ensureUploadFileUri,
  MAX_JSON_UPLOAD_BYTES,
} from "../storage/localFiles";
import type {
  GenerateInput,
  GenerationJobStatus,
  OutfitCategory,
  SavedOutfit,
  Wardrobe,
  WardrobeItem,
} from "./types";

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
        // 401 / 403 / 404-from-Clerk-rewrite all mean "session gone".
        // Clerk dev instances rewrite unauthenticated API requests to a
        // /clerk_xxx path that doesn't exist → 404. Treat any 401/403/404
        // on a non-status path the same way so the user sees "sign in again".
        if (
          res.status === 401 ||
          res.status === 403 ||
          // Only treat 404 as auth-required when the response doesn't have a
          // real API error body (i.e. Clerk's blank rewrite page, not a legit
          // "job not found" JSON body from our own status endpoint).
          (res.status === 404 &&
            !(
              typeof data === "object" &&
              data !== null &&
              "error" in data
            ))
        ) {
          throw new AuthRequiredError();
        }

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

/** Thrown when the API rejects the request because the Clerk session is
 *  missing or expired. Callers can prompt the user to sign in again. */
export class AuthRequiredError extends Error {
  constructor(message = "Sign in expired. Please sign in again.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

const UPLOAD_TIMEOUT_MS = 90_000;

function parseUploadResponse(
  status: number,
  body: string
): { path: string; url: string } {
  if (status === 401 || status === 403) {
    throw new AuthRequiredError();
  }
  if (status === 404) {
    throw new AuthRequiredError(
      "Couldn't verify your session. Please sign out and sign in again."
    );
  }

  let data: unknown = {};
  try {
    data = JSON.parse(body);
  } catch {
    if (status >= 400) {
      throw new Error(`Upload failed (${status})`);
    }
  }

  if (status < 200 || status >= 300) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : `Upload failed (${status})`;
    throw new Error(msg);
  }

  return data as { path: string; url: string };
}

function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    err.message.toLowerCase().includes("network request failed")
  );
}

async function uploadImageMultipart(
  fileUri: string,
  params: {
    fileName: string;
    contentType: string;
    kind: "wardrobe" | "profile" | "outfit_render";
  },
  token: string
) {
  const uploadPromise = FileSystem.uploadAsync(
    `${API_URL}/api/upload`,
    fileUri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: params.contentType,
      parameters: {
        kind: params.kind,
        fileName: params.fileName,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error("Upload timed out. Please try again on a faster connection.")
        ),
      UPLOAD_TIMEOUT_MS
    );
  });

  const result = await Promise.race([uploadPromise, timeoutPromise]);
  return parseUploadResponse(result.status, result.body);
}

async function uploadImageJson(
  fileUri: string,
  params: {
    fileName: string;
    contentType: string;
    kind: "wardrobe" | "profile" | "outfit_render";
  },
  token: string
) {
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists || (info.size ?? 0) > MAX_JSON_UPLOAD_BYTES) {
    throw new Error(
      "Photo is too large to upload. Try a smaller image or lower resolution."
    );
  }

  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        fileName: params.fileName,
        contentType: params.contentType,
        kind: params.kind,
        base64,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const body = await res.text();
    return parseUploadResponse(res.status, body);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Upload timed out. Please try again on a faster connection.");
    }
    throw err;
  }
}

export async function uploadImage(params: {
  uri: string;
  fileName: string;
  contentType: string;
  kind: "wardrobe" | "profile" | "outfit_render";
}) {
  const token = await tokenGetter();
  if (!token) {
    throw new AuthRequiredError();
  }

  const fileUri = await ensureUploadFileUri(params.uri, params.fileName);

  try {
    // Native multipart upload — bypasses JS bridge, works with file:// URIs.
    return await uploadImageMultipart(fileUri, params, token);
  } catch (err) {
    // Fallback for devices where multipart still fails: JSON base64 from file://
    // (safe for cropped/compressed images under ~4 MB).
    if (isNetworkError(err) || err instanceof Error) {
      try {
        return await uploadImageJson(fileUri, params, token);
      } catch (fallbackErr) {
        if (fallbackErr instanceof AuthRequiredError) throw fallbackErr;
        if (err instanceof Error && !isNetworkError(err)) throw err;
        throw fallbackErr;
      }
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

export async function patchOutfit(
  outfitId: string,
  params: {
    name?: string;
    occasion?: string;
    isSaved?: boolean;
    snapshot?: object;
  }
) {
  return apiFetch<{ id: string }>(`/api/outfits/${outfitId}`, {
    method: "PATCH",
    body: JSON.stringify(params),
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

// ─── Cart ──────────────────────────────────────────────────────────────────

export type MobileCartItem = {
  id: string;
  productCacheId: string | null;
  outfitId: string | null;
  outfitLabel: string | null;
  title: string;
  imageUrl: string | null;
  productUrl: string;
  affiliateUrl: string | null;
  effectiveUrl: string;
  retailer: string | null;
  price: number | null;
  currency: string;
  category: string | null;
  quantity: number;
  addedAt: string;
};

export type CartResponse = {
  id: string;
  itemCount: number;
  subtotal: number;
  currency: string;
  items: MobileCartItem[];
  byOutfit: {
    outfitId: string | null;
    outfitLabel: string | null;
    items: MobileCartItem[];
  }[];
};

export type CheckoutResponse = {
  itemCount: number;
  subtotal: number;
  currency: string;
  groups: {
    retailer: string;
    itemCount: number;
    subtotal: number;
    currency: string;
    items: MobileCartItem[];
    openAllUrl: string | null;
  }[];
};

export type CartItemInput = {
  productCacheId?: string;
  outfitId?: string;
  outfitLabel?: string;
  title: string;
  imageUrl?: string;
  productUrl: string;
  retailer?: string;
  price?: number;
  currency?: string;
  category?: string;
  quantity?: number;
};

export async function getCart() {
  return apiFetch<CartResponse>("/api/cart");
}

export async function addCartItem(item: CartItemInput) {
  return apiFetch<CartResponse>("/api/cart/items", {
    method: "POST",
    body: JSON.stringify({ type: "item", item }),
  });
}

export async function addOutfitToCart(params: {
  outfitId?: string;
  outfitLabel?: string;
  lookProducts: CartItemInput[];
}) {
  return apiFetch<CartResponse>("/api/cart/items", {
    method: "POST",
    body: JSON.stringify({ type: "outfit", ...params }),
  });
}

export async function removeCartItem(itemId: string) {
  return apiFetch<CartResponse>(`/api/cart/items/${itemId}`, {
    method: "DELETE",
  });
}

export async function updateCartItemQuantity(itemId: string, quantity: number) {
  return apiFetch<CartResponse>(`/api/cart/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export async function clearCart() {
  return apiFetch<{ ok: boolean }>("/api/cart", { method: "DELETE" });
}

export async function getCheckout() {
  return apiFetch<CheckoutResponse>("/api/cart/checkout");
}

// ─── Wardrobe ──────────────────────────────────────────────────────────────

export async function listWardrobes() {
  return apiFetch<Wardrobe[]>("/api/wardrobe");
}

/** Flatten the list of wardrobes into a single sorted item array — mobile UI
 *  treats the user's wardrobe as one bucket. */
export async function listWardrobeItems(): Promise<WardrobeItem[]> {
  const wardrobes = await listWardrobes();
  const items = wardrobes.flatMap((w) => w.items);
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return items;
}

export async function createWardrobeItem(params: {
  blobPath: string;
  imageUrl?: string;
  category?: OutfitCategory;
}) {
  return apiFetch<WardrobeItem>("/api/wardrobe", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function updateWardrobeItem(
  id: string,
  params: { category?: OutfitCategory; notes?: string; tags?: string[] }
) {
  return apiFetch<WardrobeItem>(`/api/wardrobe/${id}`, {
    method: "PATCH",
    body: JSON.stringify(params),
  });
}

export async function deleteWardrobeItem(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/wardrobe/${id}`, {
    method: "DELETE",
  }, 1);
}

// ─── Saved outfits ─────────────────────────────────────────────────────────

export async function listSavedOutfits() {
  return apiFetch<SavedOutfit[]>("/api/outfits");
}

export async function getSavedOutfit(id: string) {
  return apiFetch<SavedOutfit>(`/api/outfits/${id}`);
}

export async function deleteSavedOutfit(id: string) {
  return apiFetch<{ ok: boolean }>(`/api/outfits/${id}`, {
    method: "DELETE",
  }, 1);
}

// ─── Chat ──────────────────────────────────────────────────────────────────

export class ChatRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ChatRequestError";
    this.status = status;
  }
}

async function parseChatError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data === "object" && data && "error" in data) {
      const err = (data as { error: unknown }).error;
      if (typeof err === "string") return err;
      if (typeof err === "object" && err !== null) {
        return JSON.stringify(err);
      }
    }
  } catch {
    try {
      const text = await res.text();
      if (text) return text.slice(0, 200);
    } catch {
      // ignore
    }
  }
  return `Chat request failed (${res.status})`;
}

export type ChatMessageResult = {
  response: Response;
  conversationId?: string;
};

export async function sendChatMessage(params: {
  message: string;
  conversationId?: string;
}): Promise<ChatMessageResult> {
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
      throw new ChatRequestError(res.status, await parseChatError(res));
    }

    const conversationId =
      res.headers.get("X-Conversation-Id") ??
      res.headers.get("x-conversation-id") ??
      undefined;

    return { response: res, conversationId };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof ChatRequestError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Chat request timed out.");
    }
    if (err instanceof TypeError && err.message.includes("Network request failed")) {
      throw new Error("Could not reach stylist. Check your connection.");
    }
    throw err;
  }
}
