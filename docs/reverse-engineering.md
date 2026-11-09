# Reverse engineering log

Method: public behaviour only. Marketing pages, demos and docs. No decompile, no login bypass, no private API, no copied code, models or brand assets.

## REA

The original project is https://github.com/morluto/rea (`rea-agents` on npm). `npx rea-agents setup` was not run. That setup registers coding agents, including Claude, and this build is Grok-only. REA's binary and JavaScript analyzers take a local artifact. They were not pointed at a competitor app, because we do not have those binaries and we are not allowed to pull them. The investigation method — observe a public surface, write down the behaviour, implement a clean-room version from our own spec — is what this log records.

## What was observed

| Source | Public behaviour | What we built, clean-room, from our spec |
| --- | --- | --- |
| Alaaya (alaaya.in) | Touch mirror. Discover, style, try, buy. Looks drawn from inventory. A large touch screen. Rack location is not part of the published flow. | Six in-stock looks, a detail screen with fabric and rack location, no payment. |
| StyleUAI (styleuai.com) | Overnight bulk try-on, a reusable shopper photo, garment fidelity, WhatsApp, a dashboard. | Overnight pre-render of stock models. The shopper photo is session-only and is deleted. WhatsApp is a `wa.me` handoff. The dashboard is tried-not-bought. |
| Flickd, from the attached competitor notes | WhatsApp follow-up and a tried-not-bought idea. | Pre-typed `wa.me` share, and tried-not-bought as the owner report. |
| Dharpan, from the notes | Fabric detail, and a temptation to show stock counts. | Fabric and care on the detail screen. Quantities never leave the server. |
| Fynd GlamAR / endless aisle, from the notes | Browse beyond the rack, often with checkout. | Out-of-stock styles open an AuraFit-hosted page with Order on WhatsApp. No AuraFit payment. |
| H&M staff alerts, from the notes | Alerts that nobody answered. | 60 second all-staff, 120 second manager, plus a phone checklist. |
| Imersive, from the notes | Idle content on the mirror. | Idle ads by month and festival. The playlist function takes no person. |
| Breuninger, from the notes | More than one service level. | Available, Likely available, Ask staff. |

## Evidence limit

Pages were read as public marketing. No session was logged in. No network call was made to a private API. Nothing from those sites is in the repository except this description of behaviour.
