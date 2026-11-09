# AuraFit store

A dark kiosk and a light staff desk for one clothing shop.

## Ground

- Ink `#1d1d1f` on paper `#f5f5f7` for staff, owner and admin.
- Black `#000000` for the kiosk, with fill `#1d1d1f` and hairline `rgba(255,255,255,0.16)`.
- Product page paper `#f7f1e8`.
- One action blue `#0066cc`. Focus `#2997ff`.
- No second accent. No gradient. No glass. No emoji.

## Type

- UI: system UI, with Noto Sans Tamil when the session language is Tamil.
- Product headline only: Newsreader.
- Kiosk headline: clamp 40px to 64px, tracking `-0.022em`, weight 600.
- Body on the kiosk: 21px. Tables: 16px, headers 13px in muted `#6e6e73`.

## Space and shape

- Kiosk padding 32–48px. Tiles at least 132px tall and at least 15 percent of a wide screen, one column on a narrow screen.
- Radius 18px on tiles and 12px on text fields.
- Tables use a 1px line `#e0e0e0`, not cards.
- Motion is an 8px rise. It is removed when the visitor prefers reduced motion.

## Voice

- English and Tamil on every kiosk line.
- Availability is Available, Likely available, or Ask staff.
- Never fair, dark, a tone code, or a stock count.
- The product page says Order on WhatsApp. It does not take payment.

Tokens are implemented in `src/design/store.css`. The reasoning is in `docs/design.md`.
