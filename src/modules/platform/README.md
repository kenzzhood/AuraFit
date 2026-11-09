# platform

Typed contract: `index.ts`.

```
export type Role = "device" | "staff" | "owner" | "admin";
export interface Principal
export interface SessionClaims
export function resolveAuthMode(env: Record<string, string | undefined> = process.env): "mock" | "entra"
export function signSession(claims: SessionClaims, secret: string): string
export function readSession(token: string, secret: string, now: number): SessionClaims | null
export function authenticate(input:
export interface AuditEvent
export function recordAudit(log: AuditEvent[], event: AuditEvent): void
export function createLimiter()
export function readPlatformConfig(env: Record<string, string | undefined> = process.env)
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
