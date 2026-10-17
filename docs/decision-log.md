# Decision log

Times are IST. Rows record where the implementation differs from the catalogue-search prompt, or where a default was kept on purpose.

| # | Date | Area | Default in the prompt | What we did | Why | How to revert | Risk | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D-001 | 2026-10-12 | prisma/schema.prisma | New `Product` model | Fields were added on the existing `ProductIndex` and `ProductEmbedding` models | The catalogue already lives on `ProductIndex`. A second product table would split search. | Revert the `20261012_catalogue_search_v2` migration before any writer depends on the new columns | L | Shipped in WP0 |
| D-002 | 2026-10-12 | src/app/api/affiliate/route.ts | Click route `/r/{id}` | Kept `POST /api/affiliate`. New click columns are nullable and unused | The app already logs clicks and returns a redirect URL from that route. A new redirect path belongs in the verifier package | Leave the new columns null | L | Shipped in WP0 |
| D-003 | 2026-10-12 | discovery flags | Flags default toward the new index-only path over time | Start defaults leave Google Shopping, SerpAPI, and in-request Playwright on | Turning them off before the index can fill the board would drop shop links | Set `GOOGLE_SHOPPING_ENABLED`, `SERPAPI_ENABLED`, or `LIVE_PLAYWRIGHT_IN_REQUEST` to `false` | L | Shipped in WP0 |
| D-004 | 2026-10-12 | docs/baseline-metrics.md | Seven days of production logs | Baseline is the offline fixture script | Production did not record pool-by-host before this change, and CI must not call SerpAPI | Re-run `node scripts/discovery-baseline.mjs` after `DiscoveryLog` has a week of rows | L | Shipped in WP0 |
