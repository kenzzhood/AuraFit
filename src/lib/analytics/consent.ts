export const CONSENT_STORAGE_KEY = "aurafit-consent";
export const CONSENT_VERSION = "1";
export const CONSENT_EVENT = "aurafit-consent-change";
export const CONSENT_OPEN_EVENT = "aurafit-consent-open";

export type ConsentChoice = "accepted" | "rejected";

type StoredConsent = {
  version: string;
  choice: ConsentChoice;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function parseStored(raw: string | null): ConsentChoice | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (parsed.version !== CONSENT_VERSION) return null;
    if (parsed.choice === "accepted" || parsed.choice === "rejected") {
      return parsed.choice;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Read consent from localStorage. Returns null when missing or version mismatch. */
export function readConsent(): ConsentChoice | null {
  if (!isBrowser()) return null;
  try {
    return parseStored(window.localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Persist consent choice. No-ops when window is missing. */
export function writeConsent(choice: ConsentChoice): void {
  if (!isBrowser()) return;
  try {
    const payload: StoredConsent = { version: CONSENT_VERSION, choice };
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function consentAllowsAnalytics(
  choice: ConsentChoice | null
): choice is "accepted" {
  return choice === "accepted";
}

export function dispatchConsentChange(choice: ConsentChoice): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CONSENT_EVENT, { detail: { choice } })
  );
}

export function dispatchConsentOpen(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT));
}
