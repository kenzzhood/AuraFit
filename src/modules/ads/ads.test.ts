import { describe, expect, it } from "vitest";
import { idlePlaylist, readAdsConfig, type IdleAd } from "./index";

const ads: IdleAd[] = [
  { id: "offer", title: "Festive edit", titleTa: "பண்டிகை", kind: "offer" },
  { id: "pongal", title: "Pongal", titleTa: "பொங்கல்", kind: "festival", months: [1] },
];

describe("idle ads", () => {
  it("uses the calendar and never a camera", () => {
    expect(idlePlaylist(new Date("2026-11-09T12:00:00Z"), ads).map((ad) => ad.id)).toEqual([
      "offer",
    ]);
    expect(idlePlaylist(new Date("2026-01-14T12:00:00Z"), ads)).toHaveLength(2);
    expect(readAdsConfig().cameraTargeting).toBe(false);
    expect(idlePlaylist.length).toBe(2);
  });
});
