import { describe, expect, it } from "vitest";
import { applyInbound, marketingAllowed, phoneHash, shareLink } from "./index";

describe("whatsapp opt-in", () => {
  it("opens a prefilled wa.me link and markets only after YES", () => {
    const link = shareLink("919999000000", "AF-7K3Q");
    expect(link.startsWith("https://wa.me/919999000000?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("AF-7K3Q");
    const ledger: import("./index").ConsentRecord[] = [];
    const hash = phoneHash("+91 98400 11111", "salt");
    expect(
      marketingAllowed({ ledger, phoneHash: hash, storeId: "anna", sentThisMonth: 0 }).allowed
    ).toBe(false);
    applyInbound({
      ledger,
      phone: "+91 98400 11111",
      salt: "salt",
      storeId: "anna",
      text: "YES",
      now: 1,
      wordingVersion: "v1",
    });
    expect(ledger[0].phoneHash).toBe(hash);
    expect(JSON.stringify(ledger)).not.toContain("98400");
    expect(
      marketingAllowed({ ledger, phoneHash: hash, storeId: "anna", sentThisMonth: 0 }).allowed
    ).toBe(true);
    expect(
      marketingAllowed({ ledger, phoneHash: hash, storeId: "anna", sentThisMonth: 2 }).reason
    ).toBe("monthly_cap");
    applyInbound({
      ledger,
      phone: "+91 98400 11111",
      salt: "salt",
      storeId: "anna",
      text: "STOP",
      now: 2,
      wordingVersion: "v1",
    });
    expect(
      marketingAllowed({ ledger, phoneHash: hash, storeId: "anna", sentThisMonth: 0 }).allowed
    ).toBe(false);
  });
});
