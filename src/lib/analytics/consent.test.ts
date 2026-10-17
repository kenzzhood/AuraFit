import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readConsent,
  writeConsent,
  consentAllowsAnalytics,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
} from "./consent";

describe("consent", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("missing consent does not allow analytics", () => {
    expect(readConsent()).toBeNull();
    expect(consentAllowsAnalytics(null)).toBe(false);
  });

  it("rejected does not allow analytics", () => {
    writeConsent("rejected");
    expect(readConsent()).toBe("rejected");
    expect(consentAllowsAnalytics("rejected")).toBe(false);
    expect(consentAllowsAnalytics(readConsent())).toBe(false);
  });

  it("accepted allows analytics", () => {
    writeConsent("accepted");
    expect(readConsent()).toBe("accepted");
    expect(consentAllowsAnalytics("accepted")).toBe(true);
    expect(consentAllowsAnalytics(readConsent())).toBe(true);
  });

  it("persists versioned payload in localStorage", () => {
    writeConsent("accepted");
    const raw = store.get(CONSENT_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toEqual({ version: CONSENT_VERSION, choice: "accepted" });
  });

  it("no-ops when window is missing", () => {
    vi.unstubAllGlobals();
    expect(readConsent()).toBeNull();
    expect(() => writeConsent("accepted")).not.toThrow();
  });
});
