import { describe, expect, it } from "vitest";
import { assertLanOnly, isPrivateHost, readIntegrationConfig } from "./index";

describe("tally lan agent", () => {
  it("allows a private host and refuses a public one", () => {
    expect(isPrivateHost("192.168.1.20")).toBe(true);
    expect(isPrivateHost("10.0.0.5:9000")).toBe(true);
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("tally.example.com")).toBe(false);
    expect(() => assertLanOnly("8.8.8.8")).toThrow(/private/i);
    expect(readIntegrationConfig().exposePort9000).toBe(false);
  });
});
