import { describe, expect, it } from "vitest";
import { acceptAlert, checklistFor, escalationFor, queueDelivery, retryDelivery, type StaffAlert } from "./index";

function alert(createdAt: number): StaffAlert {
  return {
    id: "a1",
    storeId: "anna",
    sessionId: "s1",
    message: "Kiosk 1 — Silk saree, Rack W3",
    createdAt,
    escalation: "floor",
  };
}

describe("staff alerts", () => {
  it("escalates from the floor to everyone, then to the manager", () => {
    expect(escalationFor(alert(0), 30_000)).toBe("floor");
    expect(escalationFor(alert(0), 60_000)).toBe("all_staff");
    expect(escalationFor(alert(0), 120_000)).toBe("manager");
    expect(escalationFor(acceptAlert(alert(0), "ravi", 10_000), 200_000)).toBe("floor");
  });

  it("retries a dropped alert and then marks it delivered", () => {
    const queued = queueDelivery("a1", 0, false);
    expect(queued.queuedOffline).toBe(true);
    const retried = retryDelivery(queued, 1_000, false);
    expect(retried.attempts).toBe(1);
    expect(retried.nextAttemptAt).toBeGreaterThan(1_000);
    expect(retryDelivery(retried, 5_000, true).deliveredAt).toBe(5_000);
  });

  it("names the battery checklist for the phones that drop pushes", () => {
    expect(checklistFor("Xiaomi").join(" ")).toMatch(/autostart/i);
    expect(checklistFor("unknown").length).toBeGreaterThan(0);
  });
});
