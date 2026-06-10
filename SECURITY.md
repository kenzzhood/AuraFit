# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| `main`  | Yes       |

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Use [GitHub Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository) if enabled, or email **security@aurafit.app** (replace with your team inbox before public launch) with:

- Description of the issue
- Steps to reproduce
- Impact assessment
- Suggested fix (if any)

We aim to acknowledge reports within **72 hours** and provide a remediation timeline for confirmed issues.

## Secure development

- Never commit `.env`, `.env.local`, API keys, or connection strings.
- Use `.env.example` for variable names only.
- Rotate credentials immediately if accidental exposure occurs.
- Run `npm audit` and address high/critical findings before release.

## Production checklist

- [ ] Each deployer uses **their own** Clerk keys (`pk_` / `sk_`) — [docs/SETUP_YOUR_KEYS.md](docs/SETUP_YOUR_KEYS.md)
- [ ] Strong random `CRAWLER_API_KEY` and `INGEST_API_KEY`
- [ ] Postgres firewall restricted (not open to `0.0.0.0` in production)
- [ ] Azure Blob SAS lifetime minimized (`AZURE_BLOB_READ_SAS_MINUTES`)
- [ ] Redis configured for distributed rate limiting
- [ ] GitHub secret scanning enabled on the repository
