import { describe, expect, it } from "vitest";
import { personalPhotoAllowed, RULES } from "./index";

describe("session rules", () => {
  it("refuses a camera photo for a child, a gift, or a shopper who said no", () => {
    expect(personalPhotoAllowed({ forWhom: "child", consent: true })).toBe(false);
    expect(personalPhotoAllowed({ forWhom: "gift", consent: true })).toBe(false);
    expect(personalPhotoAllowed({ forWhom: "women", consent: false })).toBe(false);
    expect(personalPhotoAllowed({ forWhom: "men", consent: true })).toBe(true);
    expect(RULES.maxPersonalRenders).toBe(3);
  });
});
