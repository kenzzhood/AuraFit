# recommendation

Typed contract: `index.ts`.

```
export interface RecommendQuery
export interface ScoredLook
export function scoreLook(look: Look, query: RecommendQuery): ScoredLook
export function recommend(
export function publicReason(factors: string[]): string
export function assertNoToneLanguage(value: unknown): void
export function withAvailability(look: Look): Look
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
