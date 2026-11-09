# staff

Typed contract: `index.ts`.

```
export type Escalation = "floor" | "all_staff" | "manager";
export interface StaffAlert
export function escalationFor(alert: StaffAlert, now: number): Escalation
export function acceptAlert(alert: StaffAlert, staffId: string, now: number): StaffAlert
export const PHONE_CHECKLIST = [
export function checklistFor(brand: string): readonly string[]
export function readStaffConfig()
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
