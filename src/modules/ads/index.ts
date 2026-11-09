export interface IdleAd {
  id: string;
  title: string;
  titleTa: string;
  kind: "offer" | "arrival" | "festival";
  months?: number[];
}

/** Context is the clock only. There is no camera argument on purpose. */
export function idlePlaylist(now: Date, ads: IdleAd[]): IdleAd[] {
  const month = now.getUTCMonth() + 1;
  return ads.filter((ad) => !ad.months || ad.months.includes(month));
}

export function readAdsConfig() {
  return { cameraTargeting: false as const };
}
