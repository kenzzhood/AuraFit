# catalog

Typed contract: `index.ts`.

```
export const CSV_COLUMNS = [
export interface CatalogueRow
export function parseCatalogueCsv(text: string):
export function photoQualityGate(score: number): "pass" | "reshoot"
export function departmentCoverage(confirmed: number, departmentSize: number):
export function readCatalogConfig(env: Record<string, string | undefined> = process.env)
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
