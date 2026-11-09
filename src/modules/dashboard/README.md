# dashboard

Typed contract: `index.ts`.

```
export interface SessionEvent
export interface TriedRow
export function triedNotBought(events: SessionEvent[]): TriedRow[]
export function readDashboardConfig()
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
