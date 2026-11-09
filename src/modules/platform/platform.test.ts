import { describe, expect, it } from "vitest";
import {
  authenticate,
  createLimiter,
  readPlatformConfig,
  recordAudit,
  resolveAuthMode,
  signSession,
} from "./index";

describe("platform auth", () => {
  it("uses mock auth in development and refuses it in production", () => {
    expect(resolveAuthMode({ NODE_ENV: "development" })).toBe("mock");
    expect(resolveAuthMode({ NODE_ENV: "production", AURAFIT_AUTH_MODE: "mock" })).toBe(
      "entra"
    );
    const token = signSession(
      { role: "staff", storeId: "anna-nagar", id: "ravi", exp: 5_000 },
      "secret"
    );
    expect(
      authenticate({
        mode: "mock",
        entraConfigured: false,
        cookie: token,
        deviceId: null,
        secret: "secret",
        now: 1_000,
      })?.role
    ).toBe("staff");
    expect(
      authenticate({
        mode: "entra",
        entraConfigured: false,
        cookie: token,
        deviceId: "kiosk-1",
        secret: "secret",
        now: 1_000,
      })
    ).toBeNull();
    expect(readPlatformConfig({ NODE_ENV: "production" }).mode).toBe("entra");
  });

  it("rate limits and strips secrets from the audit log", () => {
    const limiter = createLimiter();
    expect(limiter.check("k", 1, 1_000, 0).ok).toBe(true);
    expect(limiter.check("k", 1, 1_000, 10).ok).toBe(false);
    const log: Parameters<typeof recordAudit>[0] = [];
    recordAudit(log, {
      ts: 1,
      action: "tryon",
      actor: "device",
      storeId: "anna",
      meta: { photo: "hidden", lookId: "saree" },
    });
    expect(log[0].meta).toEqual({ lookId: "saree" });
  });
});
