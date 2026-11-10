# AuraFit

AuraFit is the screen on the wall at Kasavu & Co, Anna Nagar. A shopper raises a hand, answers a few questions, and gets six looks from this store. A photo is optional, stays in memory, and is deleted when they leave. Kids never have a photo taken. Nothing is paid for at the kiosk.

The demo runs with no API keys.

## Mac

```bash
npm ci
npx playwright install chromium
npm run dev
```

Open http://localhost:3000

## Windows

Use PowerShell or Command Prompt from the repo root. The scripts are npm scripts, not bash.

```bat
npm ci
npx playwright install chromium
npm run dev
```

Open http://localhost:3000

Node 22 or newer. No Docker, no database server, and no `.env` file. The local database is PGlite under `.data/`, created on first boot.

A production build on your machine still uses the mock sign-in. Mac:

```bash
npm run build
AURAFIT_AUTH_MODE=mock AURAFIT_ALLOW_MOCK_AUTH=true npm run start
```

Windows PowerShell:

```powershell
npm run build
$env:AURAFIT_AUTH_MODE="mock"; $env:AURAFIT_ALLOW_MOCK_AUTH="true"; npm run start
```

Playwright's production config sets those two variables for you:

```bash
npm run build
npm run test:e2e:prod
```

## Two-minute demo

1. Open `/kiosk`. Choose "I'm on the footprints", then "Raise your hand".
2. English, "Me, women's", Office, ₹1,000–2,500, Skip, "No photo", Model B.
3. Six looks appear, each with a picture. Open one. "See it on me" keeps the garment on a model. "Save to phone" shows a code and a WhatsApp link.
4. Open `/whatsapp`, send that code, and the reply lists the looks.
5. Open `/staff` and continue. Open `/owner` for tried-but-not-bought. Open `/owner/heatmap` for anonymous zone counts.
6. Open `/admin/catalogue`, continue as admin, and mark a style "Ask staff". Open `/s/anna-nagar/missing-saree` for the hosted page. It says order on WhatsApp. It does not take payment.

## Routes

| Route | Who |
| --- | --- |
| `/` | Directory of the demo |
| `/kiosk` | The shop TV |
| `/kiosk/phone` | The person holding the phone for a group |
| `/staff` | Floor staff |
| `/owner` | Tried, not bought |
| `/owner/heatmap` | Anonymous zone counts |
| `/admin` | Stores. Heatmaps stay off until legal sign-off |
| `/admin/catalogue` | Availability labels |
| `/admin/renders` | Six core models done, the rest queued |
| `/whatsapp` | Local stand-in for Meta |
| `/s/anna-nagar/[style]` | Hosted product page |

APIs: `/api/health`, `/api/kiosk/act`, `/api/auth/session`, `/api/staff/today`, `/api/staff/stream`, `/api/staff/missing`, `/api/owner/report`, `/api/admin/stores`, `/api/admin/catalogue`, `/api/analytics/heatmap`, `/api/whatsapp/inbound`.

## Checks

```bash
npm run type-check
npm run lint
npm test
npm run build
npm run test:e2e:dev
npm run test:e2e:prod
node scripts/design-audit.mjs
```

## Not proven here

A real WhatsApp delivery, a Jetson camera, and a live Azure Container Apps deploy. `gpt-image-2.5-sunburst` is deployed on the `aurafit-image` account. `npm run assets` does not spend unless `AURAFIT_ASSET_RUN=1` and an image key are set. The pictures in the demo are the committed drawings in `public/catalog`.
