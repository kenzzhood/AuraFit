# vision

Typed contract: `index.ts`.

```
export interface VisionConfig
export function readVisionConfig(env: Record<string, string | undefined> = process.env): VisionConfig
export interface TrackedPerson
export interface VisionFrame
export interface ClaimDecision
export function claimActiveUser(
export interface CaptureQuality
export function assessCapture(quality: CaptureQuality):
export type BodyBucket = "slim" | "average" | "broad";
export type ToneCode = "t1" | "t2" | "t3";
export function bodyBucket(shoulderHip: number): BodyBucket
export function toneCode(lightness: number | null):
export function stockModelId(
export interface PhotoStore
export function createPhotoStore(): PhotoStore
```

Configuration, when this module has any, is the `read*Config` function in that file. Tests are the `*.test.ts` files beside it.
