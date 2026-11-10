export interface ConsentRecord {
  phoneHash: string;
  storeId: string;
  yes: boolean;
  stopped: boolean;
  wordingVersion: string;
  at: number;
}

export interface MarketingDecision {
  allowed: boolean;
  reason: string;
}

export function phoneHash(phone: string, salt: string): string {
  let hash = 2166136261;
  const text = `${salt}:${phone.replace(/\s+/g, "")}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ph_${(hash >>> 0).toString(16)}`;
}

export function waMeLink(number: string, text: string): string {
  const digits = number.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function shareLink(number: string, code: string): string {
  return waMeLink(number, `Send my AuraFit looks ${code}`);
}

export function applyInbound(input: {
  ledger: ConsentRecord[];
  phone: string;
  salt: string;
  storeId: string;
  text: string;
  now: number;
  wordingVersion: string;
}): ConsentRecord {
  const phoneHashValue = phoneHash(input.phone, input.salt);
  const normalised = input.text.trim().toUpperCase();
  const stopped = normalised === "STOP";
  const yes = normalised === "YES";
  const previous = [...input.ledger]
    .reverse()
    .find((row) => row.phoneHash === phoneHashValue && row.storeId === input.storeId);
  const record: ConsentRecord = {
    phoneHash: phoneHashValue,
    storeId: input.storeId,
    yes: stopped ? false : yes || Boolean(previous?.yes),
    stopped: stopped || Boolean(previous?.stopped && !yes),
    wordingVersion: input.wordingVersion,
    at: input.now,
  };
  if (stopped) record.stopped = true;
  if (yes) {
    record.yes = true;
    record.stopped = false;
  }
  input.ledger.push(record);
  return record;
}

export function marketingAllowed(input: {
  ledger: ConsentRecord[];
  phoneHash: string;
  storeId: string;
  sentThisMonth: number;
}): MarketingDecision {
  const latest = [...input.ledger]
    .reverse()
    .find((row) => row.phoneHash === input.phoneHash && row.storeId === input.storeId);
  if (!latest || !latest.yes || latest.stopped) {
    return { allowed: false, reason: "no_yes" };
  }
  if (input.sentThisMonth >= 2) return { allowed: false, reason: "monthly_cap" };
  return { allowed: true, reason: "yes" };
}

export function shareFromText(
  text: string,
  shares: { code: string; lookIds: string[] }[]
): { code: string; lookIds: string[] } | null {
  const match = text.toUpperCase().match(/AF-\d+/);
  if (!match) return null;
  return shares.find((share) => share.code === match[0]) ?? { code: match[0], lookIds: [] };
}

export function readWhatsappConfig(env: Record<string, string | undefined> = process.env) {
  return {
    number: env.AURAFIT_WHATSAPP_NUMBER ?? "919999000000",
    wordingVersion: env.AURAFIT_CONSENT_WORDING ?? "v1",
    phoneSalt: env.AURAFIT_PHONE_SALT ?? "aurafit-dev-salt",
    monthlyCap: 2,
  };
}
