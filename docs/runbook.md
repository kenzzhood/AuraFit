# Store runbook

## A kiosk is dark

`src/modules/ops` marks a device red when the heartbeat is older than three minutes, the frame rate is zero, or the temperature is at least 85°C. Amber is the middle. Green needs a fresh heartbeat, at least 20 frames a second, temperature under 75°C, and a fresh look cache.

On a Xiaomi, Vivo or Oppo phone, follow the checklist on `/staff` before the first shift. Autostart and battery restriction are the usual reasons a staff alert never arrives.

## A shopper is stuck

The session returns to idle after about 15 seconds away from the footprints, and it deletes the session photo. A child path and a gift path never store a photo. Personal try-on stops after three renders in a session.

## Stock labels

Staff mark a size missing from `/staff`. The tile becomes Ask staff. The screen never shows a quantity. Nightly sales classification lives in `src/modules/inventory`.

## Heatmap

Leave `AURAFIT_HEATMAP_ENABLED` false until counsel signs off. Admin cannot enable a store heatmap without `legalSignOff`. The ingest route rejects payloads that carry a face, photo, age, gender, name or embedding field.

## Search

Do not set `AURAFIT_ALLOW_PAID_SEARCH` or `AURAFIT_ALLOW_GOOGLE_SHOPPING` for the store. The crawler's `/crawl/google-shopping` returns 410 unless the Google Shopping allow flag is true.

## Reset the demo

Restart the Next.js process. The world lives on `globalThis` and the sessions live in a process map. Nothing is written to Postgres by the store routes.
