export interface VisionConfig {
  minHandMs: number;
  centreMin: number;
  centreMax: number;
  minHeight: number;
  minDistanceM: number;
  maxDistanceM: number;
}

export function readVisionConfig(env: Record<string, string | undefined> = process.env): VisionConfig {
  const hold = Number(env.AURAFIT_HAND_HOLD_MS ?? 1000);
  return {
    minHandMs: Number.isFinite(hold) && hold > 0 ? hold : 1000,
    centreMin: 0.35,
    centreMax: 0.65,
    minHeight: 0.45,
    minDistanceM: 0.9,
    maxDistanceM: 1.6,
  };
}

export interface TrackedPerson {
  id: string;
  /** 0 left, 1 right */
  centerX: number;
  /** Fraction of the frame height. */
  height: number;
  distanceM: number;
  handRaisedMs: number;
}

export interface VisionFrame {
  people: TrackedPerson[];
  ts: number;
}

export interface ClaimDecision {
  activeUserId: string | null;
  reason: string;
}

/** One active shopper: on the footprints, centred, large enough, hand held. */
export function claimActiveUser(
  frame: VisionFrame,
  config: VisionConfig = readVisionConfig({})
): ClaimDecision {
  const eligible = frame.people.filter(
    (person) =>
      person.centerX >= config.centreMin &&
      person.centerX <= config.centreMax &&
      person.height >= config.minHeight &&
      person.distanceM >= config.minDistanceM &&
      person.distanceM <= config.maxDistanceM &&
      person.handRaisedMs >= config.minHandMs
  );
  if (eligible.length === 0) {
    return { activeUserId: null, reason: "nobody_claimed" };
  }
  eligible.sort((a, b) => {
    const centreDelta = Math.abs(a.centerX - 0.5) - Math.abs(b.centerX - 0.5);
    if (centreDelta !== 0) return centreDelta;
    return b.height - a.height;
  });
  return { activeUserId: eligible[0].id, reason: "raised_hand" };
}

export interface CaptureQuality {
  laplacian: number;
  exposure: number;
  headVisible: boolean;
  feetVisible: boolean;
  personCount: number;
}

export function assessCapture(quality: CaptureQuality): { ok: boolean; hint: string } {
  if (quality.personCount !== 1) {
    return {
      ok: false,
      hint: "Only one person should stand on the footprints.",
    };
  }
  if (!quality.headVisible || !quality.feetVisible) {
    return {
      ok: false,
      hint: "Step back until your head and feet are in the frame.",
    };
  }
  if (quality.laplacian < 80) {
    return { ok: false, hint: "Hold still. The photo was blurry." };
  }
  if (quality.exposure < 0.25 || quality.exposure > 0.85) {
    return { ok: false, hint: "The light is uneven. Face the screen." };
  }
  return { ok: true, hint: "" };
}

export type BodyBucket = "slim" | "average" | "broad";
export type ToneCode = "t1" | "t2" | "t3";

export function bodyBucket(shoulderHip: number): BodyBucket {
  if (shoulderHip < 1.05) return "slim";
  if (shoulderHip > 1.25) return "broad";
  return "average";
}

/** Internal only. Low confidence, or no sample, stays on the middle code. */
export function toneCode(lightness: number | null): {
  code: ToneCode;
  confidence: "low" | "ok";
} {
  if (lightness == null || Number.isNaN(lightness)) {
    return { code: "t2", confidence: "low" };
  }
  if (lightness > 70) return { code: "t1", confidence: "ok" };
  if (lightness < 45) return { code: "t3", confidence: "ok" };
  return { code: "t2", confidence: "ok" };
}

export function stockModelId(
  audience: "women" | "men",
  body: BodyBucket,
  tone: ToneCode
): string {
  return `adult-${audience}-${body}-${tone}`;
}

export interface PhotoStore {
  remember(sessionId: string, bytes: Uint8Array, now: number): void;
  has(sessionId: string): boolean;
  forget(sessionId: string): boolean;
  purge(now: number, maxAgeMs?: number): number;
  count(): number;
}

export function createPhotoStore(): PhotoStore {
  const photos = new Map<string, { bytes: Uint8Array; at: number }>();
  return {
    remember(sessionId, bytes, now) {
      photos.set(sessionId, { bytes, at: now });
    },
    has(sessionId) {
      return photos.has(sessionId);
    },
    forget(sessionId) {
      return photos.delete(sessionId);
    },
    purge(now, maxAgeMs = 60 * 60 * 1000) {
      let removed = 0;
      for (const [id, entry] of photos) {
        if (now - entry.at > maxAgeMs) {
          photos.delete(id);
          removed += 1;
        }
      }
      return removed;
    },
    count() {
      return photos.size;
    },
  };
}
