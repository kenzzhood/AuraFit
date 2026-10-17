# Contributing to AuraFit

Thank you for contributing. This project powers a production AI fashion styling platform — please follow these guidelines.

## Getting started

1. Fork the repository and clone locally.
2. Copy environment templates and add **your own** keys — see [docs/SETUP_YOUR_KEYS.md](docs/SETUP_YOUR_KEYS.md):
   ```bash
   cp .env.example .env.local
   cp apps/mobile/.env.example apps/mobile/.env
   ```
3. Install dependencies: `npm install`
4. Start Postgres locally and run `npm run db:push`
5. Run the web app: `npm run dev`

See [README.md](README.md) and [docs/mobile-setup.md](docs/mobile-setup.md) for full setup.

## Before your first PR

If you are preparing a public release and secrets were ever committed:

1. [docs/SETUP_YOUR_KEYS.md](docs/SETUP_YOUR_KEYS.md) — use your own credentials only
2. [docs/security/git-history-purge.md](docs/security/git-history-purge.md) — remove historical secret artifacts
3. [docs/security/release-readiness.md](docs/security/release-readiness.md) — release gate checklist

## Pull requests

- Keep changes focused and well-scoped.
- Match existing TypeScript / Python style in the touched files.
- Do **not** commit secrets, `.env` files, or encrypted credential bundles.
- Run before submitting:
  ```bash
  npm run lint
  npm run type-check
  npm test
  cd services/product-crawler && python -m pytest tests/
  ```

## Security

Read [SECURITY.md](SECURITY.md). Report vulnerabilities privately — do not file public issues for security bugs.

## Code of conduct

Be respectful and constructive in issues and pull requests.
