# search

Typed contract: `index.ts`.

```
export interface Searchable
export function searchCatalogue<T extends Searchable>(items: T[], query: string): T[]
export function readSearchConfig()
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
