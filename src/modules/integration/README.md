# integration

Typed contract: `index.ts`.

```
export function isPrivateHost(host: string): boolean
export function assertLanOnly(host: string): void
export function readIntegrationConfig()
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
