export type Escalation = "floor" | "all_staff" | "manager";

export interface StaffAlert {
  id: string;
  storeId: string;
  sessionId: string;
  message: string;
  createdAt: number;
  acceptedBy?: string;
  acceptedAt?: number;
  escalation: Escalation;
}

export function escalationFor(alert: StaffAlert, now: number): Escalation {
  if (alert.acceptedAt != null) return "floor";
  const age = now - alert.createdAt;
  if (age >= 120_000) return "manager";
  if (age >= 60_000) return "all_staff";
  return "floor";
}

export function acceptAlert(alert: StaffAlert, staffId: string, now: number): StaffAlert {
  return {
    ...alert,
    acceptedBy: staffId,
    acceptedAt: now,
    escalation: "floor",
  };
}

export const PHONE_CHECKLIST = [
  { brand: "xiaomi", steps: ["Allow autostart", "No battery restriction", "Lock the app in recents"] },
  { brand: "vivo", steps: ["Allow autostart", "High background power", "Lock the app in recents"] },
  { brand: "oppo", steps: ["Allow autostart", "No battery restriction", "Lock the app in recents"] },
  { brand: "other", steps: ["Allow notifications", "Disable battery optimisation for AuraFit"] },
] as const;

export function checklistFor(brand: string): readonly string[] {
  const found = PHONE_CHECKLIST.find((item) => item.brand === brand.toLowerCase());
  return (found ?? PHONE_CHECKLIST[3]).steps;
}

export interface Delivery {
  alertId: string;
  attempts: number;
  nextAttemptAt: number;
  deliveredAt: number | null;
  queuedOffline: boolean;
}

export function queueDelivery(alertId: string, now: number, online: boolean): Delivery {
  return {
    alertId,
    attempts: 0,
    nextAttemptAt: now,
    deliveredAt: null,
    queuedOffline: !online,
  };
}

export function retryDelivery(delivery: Delivery, now: number, ok: boolean): Delivery {
  if (ok) return { ...delivery, deliveredAt: now, queuedOffline: false };
  const attempts = delivery.attempts + 1;
  return {
    ...delivery,
    attempts,
    queuedOffline: true,
    nextAttemptAt: now + Math.min(30_000, 1_000 * 2 ** attempts),
  };
}

export function readStaffConfig() {
  return { ackTargetMs: 120_000, escalateAllMs: 60_000, escalateManagerMs: 120_000 };
}
