# Run the store locally

```bash
cp .env.example .env.local
npm ci
npx prisma generate
npm run dev
```

Open these paths:

- `http://localhost:3000/kiosk` — the TV. Press a tile, or hold it.
- `http://localhost:3000/kiosk/phone` — model looks only. No camera step.
- `http://localhost:3000/staff` — Continue signs in the floor staff session.
- `http://localhost:3000/owner` — tried, not bought.
- `http://localhost:3000/admin` — stores. Requesting a heatmap without legal sign-off is refused.
- `http://localhost:3000/s/anna-nagar/kanjivaram` — hosted product page.

The store routes work when Clerk is not configured. The social studio still expects Clerk or `ALLOW_UNAUTHENTICATED_DEV=true`.

`AURAFIT_AUTH_MODE=mock` is the local default. Production refuses mock auth unless `AURAFIT_ALLOW_MOCK_AUTH=true`. Leave that unset.

No Azure spend is required for this local path. Image generation, Blob, Entra and Tally are interfaces. The demo uses the in-memory catalogue in `src/modules/runtime/world.ts`.

When a real render is needed, set one model value and the Foundry resource. Do not set an OpenAI image key.

```
AURAFIT_IMAGE_MODEL=gpt-image-2.5-sunburst
AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com
AZURE_OPENAI_API_KEY=
```

`AURAFIT_IMAGE_MODEL` is the deployment name. The default version is 2026-09-09. It retires on 2027-09-09. Optional image-specific endpoint and key: `AZURE_OPENAI_IMAGE_ENDPOINT` and `AZURE_OPENAI_IMAGE_API_KEY`.

Checks:

```bash
npm run lint
npm run type-check
npm test
npm run build
node scripts/design-audit.mjs
```
