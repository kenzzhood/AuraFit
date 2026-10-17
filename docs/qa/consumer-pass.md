# Consumer pass — 25 Sep 2026

Tested as a signed-out visitor against local `http://127.0.0.1:3210` and production `https://aurafit-web.blackstone-033a1f17.eastus2.azurecontainerapps.io`. No Clerk browser session was available, so signed-in generate, chat, wardrobe, cart, and billing were not clicked through. Those routes were checked as an outsider (redirect or 401) and by reading the empty-state UI.

## Journeys

| Journey | Result | Evidence |
|---|---|---|
| Home, pricing, privacy, terms, refund, affiliate | Pass locally (200, one `h1` on home and pricing, unique titles) | HTTP fetch |
| Explore page shell | Pass (200, one `h1`) | HTTP fetch |
| Explore feed when there are no posts | Fail | Production `GET /api/posts` returned `{posts:[], hasMore:false}`. The feed renders an empty grid and no message |
| Explore feed when the API errors | Fail | Local Postgres was down (`127.0.0.1:54322`). `GET /api/posts` returned 500. The feed looks the same as an empty community |
| robots.txt and sitemap.xml locally | Pass | `200` `text/plain` and `application/xml`, private routes disallowed |
| robots.txt and sitemap.xml on production | Fail until this revision is deployed | `curl -I` is `307` to `/sign-in`. The live app’s CSP also lacks the analytics hosts added in this working tree, so production is an older revision |
| Consent bar click-through | Not completed in a browser | Cookie settings is in the homepage HTML. Accept/Reject render after hydration. Headless Chrome hung, so the click was not exercised |
| Signed-out `/generate` and `/chat` | Pass | Browser navigation lands on Sign in. `GET /api/generate` and `GET /api/chat` return `401` `{"error":"Unauthorized"}` locally and on production |
| Signed-in generate, chat, wardrobe, cart, billing | Blocked | No Clerk session. Cart and wardrobe already have empty-state copy in the UI. One generate and one chat turn were not run |
| Pricing while billing is off | Fail on the paid-button path | Checkout sets an error that tells the shopper to turn on `BILLING_ENABLED`. Catalog itself returns `billingEnabled: false` and a normal plan list |
| Cold start | Deferred | The first production sweep took about 41s across nine URLs. Later single requests were 2–7s. Scale-to-zero stays, to avoid a always-on replica charge |
| Redis fail-closed | Fail in repo, not on the live revision | Live container env has `CACHE_PROVIDER=memory` and no `REDIS_URL` or `RATE_LIMIT_REQUIRE_REDIS`. [infra/modules/container-app-web.bicep](../../infra/modules/container-app-web.bicep) sets `RATE_LIMIT_REQUIRE_REDIS=true` without `REDIS_URL`. The next deploy would fail generation, HD, billing, and affiliate limits closed |

## Fixes in this pass

1. Explore feed shows a message when the community is empty, and a different message when the request fails.
2. Pricing checkout copy no longer mentions environment variables.
3. `RATE_LIMIT_REQUIRE_REDIS` stays `false` until `REDIS_URL` exists, so a deploy cannot turn Generate off.

## After the fixes

- `PostFeed` shows “No public looks yet…” when the feed succeeds with zero posts, and “The look feed is unavailable right now…” when the request fails. Loading still shows “Loading feed…”.
- Pricing checkout, when billing is off, now says paid plans are not open yet and Free still works. It no longer names `BILLING_ENABLED`.
- Web container env `RATE_LIMIT_REQUIRE_REDIS` is `false` in Bicep until `REDIS_URL` is set. The live app already had neither variable, so this stops the next deploy from closing generation.
- Local `/explore`, `/pricing`, `/robots.txt`, and `/sitemap.xml` were fetched again after the edits and still return 200. The empty-feed sentence is client-rendered, so it is not in the first HTML payload.
- Production was not redeployed. `/robots.txt` there still redirects to sign-in until this revision ships.

## Left as-is

- Look planning and product search order.
- `minReplicas: 0` on the web app.
- No new Redis. In-memory limits apply per replica until a cache is worth the cost.
- Signed-in studio was not exercised without a session.
- Production robots/sitemap stay on the old revision until this tree is deployed.
