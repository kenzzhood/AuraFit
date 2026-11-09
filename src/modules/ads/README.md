# ads

Typed contract: `index.ts`.

```
export interface IdleAd
export function idlePlaylist(now: Date, ads: IdleAd[]): IdleAd[]
export function readAdsConfig()
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
