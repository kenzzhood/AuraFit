import { createHmac, timingSafeEqual } from "node:crypto";

export type Role = "device" | "staff" | "owner" | "admin";

export interface Principal {
  role: Role;
  storeId: string;
  id: string;
}

export interface SessionClaims {
  role: Exclude<Role, "device">;
  storeId: string;
  id: string;
  exp: number;
}

export function resolveAuthMode(env: Record<string, string | undefined> = process.env): "mock" | "entra" {
  if (env.AURAFIT_AUTH_MODE === "entra") return "entra";
  if (env.AURAFIT_AUTH_MODE === "mock") {
    if (env.NODE_ENV === "production" && env.AURAFIT_ALLOW_MOCK_AUTH !== "true") {
      return "entra";
    }
    return "mock";
  }
  return env.NODE_ENV === "production" ? "entra" : "mock";
}

export function signSession(claims: SessionClaims, secret: string): string {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(token: string, secret: string, now: number): SessionClaims | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionClaims;
    if (!claims.exp || claims.exp < now) return null;
    if (!["staff", "owner", "admin"].includes(claims.role)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function authenticate(input: {
  mode: "mock" | "entra";
  entraConfigured: boolean;
  cookie: string | null;
  deviceId: string | null;
  secret: string;
  now: number;
}): Principal | null {
  if (input.mode === "entra" && !input.entraConfigured) return null;
  if (input.cookie) {
    const claims = readSession(input.cookie, input.secret, input.now);
    if (claims) return { role: claims.role, storeId: claims.storeId, id: claims.id };
  }
  if (
    input.mode === "mock" &&
    input.deviceId &&
    /^[a-z0-9-]{3,64}$/.test(input.deviceId)
  ) {
    return { role: "device", storeId: "anna-nagar", id: input.deviceId };
  }
  return null;
}

export interface AuditEvent {
  ts: number;
  action: string;
  actor: string;
  storeId: string;
  meta: Record<string, string | number | boolean>;
}

const SECRET_KEY = /photo|phone|image|face|bytes|token|secret/i;

export function recordAudit(log: AuditEvent[], event: AuditEvent): void {
  const meta: AuditEvent["meta"] = {};
  for (const [key, value] of Object.entries(event.meta)) {
    if (SECRET_KEY.test(key)) continue;
    meta[key] = value;
  }
  log.push({ ...event, meta });
}

export function createLimiter() {
  const hits = new Map<string, number[]>();
  return {
    check(key: string, limit: number, windowMs: number, now: number) {
      const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
      if (recent.length >= limit) {
        return { ok: false as const, retryAfterMs: windowMs - (now - recent[0]) };
      }
      recent.push(now);
      hits.set(key, recent);
      return { ok: true as const, retryAfterMs: 0 };
    },
  };
}

export function readPlatformConfig(env: Record<string, string | undefined> = process.env) {
  return {
    mode: resolveAuthMode(env),
    secret: env.AURAFIT_SESSION_SECRET ?? "aurafit-dev-session",
    entraConfigured: Boolean(env.AURAFIT_ENTRA_TENANT_ID && env.AURAFIT_ENTRA_CLIENT_ID),
  };
}
