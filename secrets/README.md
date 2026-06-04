# Encrypted secrets

Plaintext API keys and env files are **never** committed. They live in:

| File | Purpose |
|------|---------|
| `secrets/env.bundle.enc` | OpenSSL AES-256-CBC encrypted bundle (web + mobile + azd env) |
| `.secrets-passphrase` | Local passphrase file (**gitignored** — store in your password manager) |

## Encrypt (after changing keys)

```bash
# First time: generate a passphrase and save it locally
openssl rand -base64 32 > .secrets-passphrase
chmod 600 .secrets-passphrase

AURAFIT_SECRETS_PASSPHRASE_FILE=.secrets-passphrase bash scripts/secrets-encrypt.sh
git add secrets/env.bundle.enc && git commit -m "chore: rotate encrypted secrets bundle"
```

## Decrypt (new machine / teammate)

```bash
AURAFIT_SECRETS_PASSPHRASE='your-passphrase' bash scripts/secrets-decrypt.sh
# or
AURAFIT_SECRETS_PASSPHRASE_FILE=.secrets-passphrase bash scripts/secrets-decrypt.sh
```

## What stays out of git

- `.env`, `.env.local`, `apps/mobile/.env`
- `.secrets-passphrase`
- `__pycache__/`, `*.pyc`

Use `.env.example` and `apps/mobile/.env.example` for non-secret variable names.
