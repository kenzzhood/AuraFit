function ipv4(host: string): number[] | null {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts;
}

/** Tally stays on the store LAN. Port 9000 is never treated as a public address. */
export function isPrivateHost(host: string): boolean {
  const normalised = host.trim().toLowerCase().replace(/:\d+$/, "");
  if (!normalised || normalised.includes("/")) return false;
  if (normalised === "localhost" || normalised.endsWith(".local")) return true;
  const parts = ipv4(normalised);
  if (!parts) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function assertLanOnly(host: string): void {
  if (!isPrivateHost(host)) {
    throw new Error("Tally host must be a private LAN address");
  }
}

export function readIntegrationConfig() {
  return { exposePort9000: false as const, connectors: ["excel", "tally"] as const };
}
