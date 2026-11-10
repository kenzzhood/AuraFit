# Graph Report - /workspace  (2026-11-09)

The 10 November 2026 store cut deletes the consumer provider graph (`getAIProvidersOrdered` and the crawler). Live boundaries are `src/modules/*`, `src/db`, and `src/app/(store)`. The JSON graph below is the previous extract and still names those deleted nodes.

## Corpus Check
- Full-repo detect counted the files above. AST extraction was scoped to the store modules and the provider gates so the graph stays reviewable. Semantic nodes were written by Grok from the product docs. Claude subagents were not used.

## Summary
- 181 nodes · 222 edges · 26 communities detected
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `page.tsx` - 12 edges
2. `act()` - 8 edges
3. `choose()` - 5 edges
4. `toView()` - 5 edges
5. `getAIProvidersOrdered()` - 4 edges
6. `assignLooks()` - 4 edges
7. `applyClock()` - 4 edges
8. `admin-app.tsx` - 3 edges
9. `kiosk-app.tsx` - 3 edges
10. `admin()` - 3 edges
11. `GET()` - 3 edges
12. `POST()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Paid search off` --specifies--> `paidSearchAllowed()`  [EXTRACTED]
  docs/product/AuraFit_Product_Spec_v1.md → /workspace/src/lib/search/policy.ts
- `Heatmap flag` --specifies--> `ingestHeatmap()`  [EXTRACTED]
  docs/product/AuraFit_Product_Spec_v1.md → /workspace/src/modules/analytics/index.ts
- `Image generation` --specifies--> `routeGeneration()`  [EXTRACTED]
  docs/product/AuraFit_image_stack_decisions.md → /workspace/src/modules/generation/index.ts
- `Session intelligence` --specifies--> `personalPhotoAllowed()`  [EXTRACTED]
  docs/product/AuraFit_Product_Spec_v1.md → /workspace/src/modules/intelligence/index.ts
- `Inventory labels` --specifies--> `classifyAvailability()`  [EXTRACTED]
  docs/product/AuraFit_Product_Spec_v1.md → /workspace/src/modules/inventory/index.ts
- `Recommendation` --specifies--> `recommend()`  [EXTRACTED]
  docs/product/AuraFit_Product_Spec_v1.md → /workspace/src/modules/recommendation/index.ts
- `No kiosk payment` --specifies--> `buildProductPage()`  [EXTRACTED]
  docs/product/AuraFit_Product_Spec_v1.md → /workspace/src/modules/storefront/index.ts
- `Camera vision` --specifies--> `claimActiveUser()`  [EXTRACTED]
  docs/product/AuraFit_Product_Spec_v1.md → /workspace/src/modules/vision/index.ts

## Communities

### Community 0 - "community-0 (57 nodes)"
Cohesion: 0.04
Nodes (0): 

### Community 1 - "community-1 (19 nodes)"
Cohesion: 0.2
Nodes (14): act(), applyClock(), assignLooks(), blank(), choose(), copyFor(), findLook(), finishRender() (+6 more)

### Community 2 - "community-2 (17 nodes)"
Cohesion: 0.12
Nodes (7): admin-app.tsx, load(), signIn(), kiosk-app.tsx, owner-app.tsx, page.tsx, staff-app.tsx

### Community 3 - "community-3 (12 nodes)"
Cohesion: 0.18
Nodes (2): inferSourceFromStore(), mapSerpapiShoppingResult()

### Community 4 - "community-4 (12 nodes)"
Cohesion: 0.27
Nodes (8): admin(), GET(), POST(), staff(), createDemoWorld(), getWorld(), look(), seedLooks()

### Community 5 - "community-5 (11 nodes)"
Cohesion: 0.29
Nodes (9): analyzePersonWithFallback(), generateLooksWithFallback(), getAIProvider(), getAIProviderName(), getAIProvidersOrdered(), getStorageProvider(), getStorageProviderName(), getTryOnProvidersOrdered() (+1 more)

### Community 6 - "community-6 (8 nodes)"
Cohesion: 0.25
Nodes (0): 

### Community 7 - "community-7 (4 nodes)"
Cohesion: 0.67
Nodes (2): guardOrAllow(), isStoreSurface()

### Community 8 - "community-8 (4 nodes)"
Cohesion: 0.5
Nodes (2): Paid search off, paidSearchAllowed()

### Community 9 - "community-9 (3 nodes)"
Cohesion: 0.67
Nodes (3): WhatsApp handoff, applyInbound(), phoneHash()

### Community 10 - "community-10 (3 nodes)"
Cohesion: 0.67
Nodes (3): assertLanOnly(), ipv4(), isPrivateHost()

### Community 11 - "community-11 (3 nodes)"
Cohesion: 0.67
Nodes (3): Recommendation, mmr(), recommend()

### Community 12 - "community-12 (3 nodes)"
Cohesion: 1.0
Nodes (2): readBool(), readDiscoveryFlags()

### Community 13 - "community-13 (2 nodes)"
Cohesion: 1.0
Nodes (2): Session intelligence, personalPhotoAllowed()

### Community 14 - "community-14 (2 nodes)"
Cohesion: 1.0
Nodes (2): No reusable avatar, createPhotoStore()

### Community 15 - "community-15 (2 nodes)"
Cohesion: 1.0
Nodes (2): shareLink(), waMeLink()

### Community 16 - "community-16 (2 nodes)"
Cohesion: 1.0
Nodes (2): authenticate(), readSession()

### Community 17 - "community-17 (2 nodes)"
Cohesion: 1.0
Nodes (2): readPlatformConfig(), resolveAuthMode()

### Community 18 - "community-18 (2 nodes)"
Cohesion: 1.0
Nodes (2): Image generation, routeGeneration()

### Community 19 - "community-19 (2 nodes)"
Cohesion: 1.0
Nodes (2): No kiosk payment, buildProductPage()

### Community 20 - "community-20 (2 nodes)"
Cohesion: 1.0
Nodes (2): Heatmap flag, ingestHeatmap()

### Community 21 - "community-21 (2 nodes)"
Cohesion: 1.0
Nodes (0): 

### Community 22 - "community-22 (2 nodes)"
Cohesion: 1.0
Nodes (2): Camera vision, claimActiveUser()

### Community 23 - "community-23 (2 nodes)"
Cohesion: 1.0
Nodes (2): Inventory labels, classifyAvailability()

### Community 24 - "community-24 (2 nodes)"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "community-25 (1 nodes)"
Cohesion: 1.0
Nodes (1): layout.tsx

## Knowledge Gaps
- **11 isolated node(s):** `layout.tsx`, `Camera vision`, `Image generation`, `Recommendation`, `Session intelligence` (+6 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `community-13 (2 nodes)`** (2 nodes): `Session intelligence`, `personalPhotoAllowed()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-14 (2 nodes)`** (2 nodes): `No reusable avatar`, `createPhotoStore()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-15 (2 nodes)`** (2 nodes): `shareLink()`, `waMeLink()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-16 (2 nodes)`** (2 nodes): `authenticate()`, `readSession()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-17 (2 nodes)`** (2 nodes): `readPlatformConfig()`, `resolveAuthMode()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-18 (2 nodes)`** (2 nodes): `Image generation`, `routeGeneration()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-19 (2 nodes)`** (2 nodes): `No kiosk payment`, `buildProductPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-20 (2 nodes)`** (2 nodes): `Heatmap flag`, `ingestHeatmap()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-21 (2 nodes)`** (2 nodes): `staff.test.ts`, `alert()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-22 (2 nodes)`** (2 nodes): `Camera vision`, `claimActiveUser()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-23 (2 nodes)`** (2 nodes): `Inventory labels`, `classifyAvailability()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-24 (2 nodes)`** (2 nodes): `vision.test.ts`, `person()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `community-25 (1 nodes)`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.