# Hackathon submission checklist

Pass/fail status for judges, demo day, and repository review.

**Last audited:** 2026-06-05

---

## Repository

| Item | Status | Notes |
|------|--------|-------|
| GitHub repository exists | **PASS** | Private repo `kenzzhood/AuraFit` — flip public after purge + rotation |
| Clean commit history (no secrets) | **FAIL** | `secrets/env.bundle.enc` in commit `a2558fa` — run [git-history-purge.md](../security/git-history-purge.md) |
| LICENSE (MIT) | **PASS** | [LICENSE](LICENSE) |
| SECURITY.md | **PASS** | [SECURITY.md](SECURITY.md) |
| CONTRIBUTING.md | **PASS** | [CONTRIBUTING.md](CONTRIBUTING.md) |
| CI workflow | **PASS** | [.github/workflows/ci.yml](.github/workflows/ci.yml) — build on push/PR |
| No personal Azure resource names in docs | **PASS** | Sanitized in `docs/deploy/azure-runbook.md`, `infra/main.bicep` |

---

## README & documentation

| Item | Status | Notes |
|------|--------|-------|
| Project overview | **PASS** | [README.md](README.md) |
| Architecture diagram | **PASS** | Mermaid in README |
| Tech stack | **PASS** | README + [docs/architecture-v2.md](docs/architecture-v2.md) |
| Setup instructions | **PASS** | README, [checklist.md](../deploy/checklist.md) |
| Environment variables | **PASS** | `.env.example` + README table |
| Deployment guide | **PASS** | [azure-runbook.md](../deploy/azure-runbook.md), [setup.md](setup.md) |

---

## Demo assets

| Item | Status | Notes |
|------|--------|-------|
| Screenshots in repo | **FAIL** | Placeholder at [docs/screenshots/](docs/screenshots/) — add PNGs before submission |
| Demo video | **FAIL** | Not linked in README — record 2–3 min walkthrough and add URL |
| APK download link | **PARTIAL** | Build via EAS ([docs/MOBILE_BUILD.md](docs/MOBILE_BUILD.md)); add stable link to README Releases or Expo artifact URL |
| Pitch deck | **PARTIAL** | `Aurafit_Pitch_Deck - Final.pptx` exists locally but is **untracked** — add to `docs/` or link from Google Drive |
| Architecture diagrams | **PASS** | Mermaid in README; extended in `docs/architecture-v2.md` |
| Live demo URL | **PARTIAL** | Azure URL available when `azure:start` is run; document current URL in README before judging |

---

## Technical demo readiness

| Item | Status | Notes |
|------|--------|-------|
| Web app builds | **PASS** | `npm run build` succeeds |
| Security tests | **PASS** | `npm test` — SSRF unit tests |
| Auth flow | **PASS** | Clerk on web + mobile |
| AI generation | **PASS** | Requires Azure OpenAI configured |
| Real product links | **PASS** | Self-hosted crawler pipeline |
| Mobile app | **PASS** | Expo app in `apps/mobile` |
| Cost pause/resume | **PASS** | `npm run azure:stop` / `azure:start` |

---

## Security (judge-facing)

| Item | Status | Notes |
|------|--------|-------|
| Critical/High vulns fixed in code | **PASS** | See [audit.md](../security/audit.md) |
| Secrets in working tree | **PASS** | `env.bundle.enc` deleted locally |
| Secrets in git history | **FAIL** | Operational blocker — purge required |
| Credential setup | **BYOK** | [docs/SETUP_YOUR_KEYS.md](docs/SETUP_YOUR_KEYS.md) |
| IDOR protections | **PASS** | Chat + product sessions |
| SSRF protections | **PASS** | Web + crawler |
| Rate limiting | **PASS** | Chat, search, recommendations, generation |

---

## Recommended actions before submission

### Must do (blockers)

1. [ ] Configure your own keys ([docs/SETUP_YOUR_KEYS.md](docs/SETUP_YOUR_KEYS.md))
2. [ ] Purge git history ([git-history-purge.md](../security/git-history-purge.md))
3. [ ] Commit security + docs changes; force-push clean history
4. [ ] Make repository **public**
5. [ ] Enable GitHub secret scanning

### Should do (presentation)

6. [ ] Add 4–6 screenshots to `docs/screenshots/` and link in README
7. [ ] Record demo video (upload to YouTube/Loom; link in README)
8. [ ] Build fresh APK; add download link to README
9. [ ] Add pitch deck to repo or README link
10. [ ] Start Azure stack before judging; paste live URL in README

### Nice to have

11. [ ] GitHub Release with APK attached
12. [ ] One-page architecture PDF export for judges
13. [ ] PostHog/Sentry demo dashboard screenshot

---

## Submission packet template

Copy into hackathon portal:

```
Project: AuraFit
Tagline: AI-native fashion styling — upload your photo, get six editorial looks, shop with real links.

GitHub: https://github.com/kenzzhood/AuraFit
Live demo: https://aurafit-web.<your-domain>.azurecontainerapps.io
Demo video: <ADD URL>
APK: <ADD Expo artifact or GitHub Release URL>

Stack: Next.js 15, Expo, PostgreSQL, Azure OpenAI, Playwright crawler, Clerk

Key differentiators:
- Self-hosted product discovery (no SerpAPI dependency)
- Multi-image fashion board generation with identity preservation
- Mobile-first local photo storage with cloud AI orchestration
```
