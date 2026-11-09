# whatsapp

Typed contract: `index.ts`.

```
export interface ConsentRecord
export interface MarketingDecision
export function phoneHash(phone: string, salt: string): string
export function waMeLink(number: string, text: string): string
export function shareLink(number: string, code: string): string
export function applyInbound(input:
export function marketingAllowed(input:
export function readWhatsappConfig(env: Record<string, string | undefined> = process.env)
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
