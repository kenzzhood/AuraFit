# Engineering method

## Image model

Adult try-on and adult stock renders call Azure OpenAI only. The deployment name is the single env value `AURAFIT_IMAGE_MODEL`. The default is `gpt-image-2.5-sunburst`, version `2026-09-09` (GA on Azure). It retires on `2027-09-09`. `gpt-image-2` retires on `2027-10-21`. Microsoft's schedule names no replacement for either date.

`gpt-image-2.6-sunburst` is the planned swap once Azure lists it. Set `AURAFIT_IMAGE_MODEL=gpt-image-2.6-sunburst` then. Do not call it before that, and do not call `api.openai.com` for images.

The health check and process startup warn when the configured model is inside 90 days of a known retirement date. Face preservation for a consenting adult still uses the Azure edit call with the session photo. `src/modules/generation/face-preservation.fixture.ts` records that identity consistency on 2.5 Sunburst has not been checked yet. That check is required before the pilot. Children stay on synthetic models.

Hosting is unchanged. The app still reads `AZURE_OPENAI_ENDPOINT` (or `AZURE_OPENAI_IMAGE_ENDPOINT`) and the matching key. Those are the Foundry resource the image call uses. No new Azure hosting was added for this switch.

## Superpowers

Installed from https://github.com/obra/superpowers by copying each `skills/*/SKILL.md` into `.cursor/skills/superpowers-<name>/SKILL.md`. Cursor's marketplace install (`/add-plugin superpowers`) cannot be clicked from this environment. The upstream installer also wires Claude Code hooks. Those hooks were not installed. The skill text is the method, and it is followed by Grok.

How it was applied to this build:

- **Brainstorm, then plan.** The product spec and the image-stack decisions were read before modules were named. The decisions file wins where the two disagree. The plan is the module table in `docs/architecture.md`.
- **Test-driven implementation.** Each module has a Vitest file that states the rule (no child photo, no stock count, heatmap off, paid search off) and the implementation sits beside it. The session flow test was written against the screen contract and then the engine was adjusted until it passed, including the three-try-on cap.
- **Systematic debugging.** The night-render test originally asked for an `audience` field that jobs do not have. The assertion was removed rather than adding a fake field. Catalogue search matched the word "rack" in two locations; the query was changed to a style name. Type errors from `ProcessEnv` requiring `NODE_ENV` were fixed by accepting a plain env record. The phone page imported a path that does not exist; the import was corrected.
- **Code review.** Public JSON is asserted free of tone words and quantities. Audit metadata drops keys that look like photos, phones, or secrets. Staff and admin routes check the session role.
- **Verification before completion.** `npm test`, `npm run type-check`, lint, `npm run build`, and a local request against the kiosk, staff, owner, admin and product routes are the gate. A screen is not done on a screenshot alone.

## Addy Osmani agent-skills

Vendored from https://github.com/addyosmani/agent-skills into `.cursor/skills/osmani-*`. Used as a checklist, not as a second process.

| Checklist | What changed |
| --- | --- |
| Security and hardening | HMAC session cookie, httpOnly, role checks, rate limit on the kiosk, audit log, CSP already on the Next config, paid-search double gate, LAN-only integration helper, heatmap default off. |
| Performance | Six looks come from memory. Personal try-on is capped at three. Night rendering pauses while the store is open. The kiosk does not ship WebGL. |
| Frontend UI | One type scale, one blue, tables instead of card grids, Tamil font, reduced motion. See `docs/design.md`. |
| Test-driven development | Module tests plus the session flow test. 249 tests passing at the time of the store PR. |
| Shipping and launch | Local mock path documented in `docs/setup.md`. No cloud deploy and no spend in this change. |
| Code review and quality | Public DTOs, secret-key stripping, and the design audit script. |
