# inventory

Typed contract: `index.ts`.

```
export interface StockSignal
export interface AvailabilityDecision
export function classifyAvailability(signal: StockSignal): AvailabilityDecision
export function publicStockLabel(decision: AvailabilityDecision): string
export interface SalesRow
export function applyNightlySales(
export function readInventoryConfig(env: Record<string, string | undefined> = process.env)
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
