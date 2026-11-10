# Design

The kiosk is a dark theatre. Staff, owner and admin sit on a light paper page. The product page sits on a warm paper so a silk reads as cloth rather than a dashboard.

## Tokens

`src/design/store.css` is the token source for the store surface.

| Token | Value | Taken from |
| --- | --- | --- |
| Ink | `#1d1d1f` | Apple product pages, via awesome-design-md |
| Paper | `#f5f5f7` | Apple |
| Action | `#0066cc` | Apple link blue |
| Focus | `#2997ff` | Apple on-dark blue, used here as the focus ring |
| Kiosk ground | `#000000` | Apple product theatre |
| Product paper | `#f7f1e8` | Oura's calm cream, not Oura's gold or clay |
| Headline serif | Newsreader | A light serif in the Oura direction, used only on the product page |
| UI type | System UI plus Noto Sans Tamil | Apple's system stack, with Tamil coverage the system font does not guarantee |
| Radius | 18px | A rounded rectangle. Not a pill on every control |
| Motion | 8px rise, 420ms, disabled under `prefers-reduced-motion` | Short and physical |

Linear's hairline tables and quiet density are used on staff, owner and admin. Linear's lavender `#5e6ad2` and near-black `#010102` are not used.

Copies of the source analyses sit in `docs/design-references/`. They are reference, not brand assets. No Apple, Linear or Oura marks are in the product.

## What each reference contributed

- **Apple** (`docs/design-references/apple.DESIGN.md`, from VoltAgent/awesome-design-md): ink, parchment, one blue action, black kiosk, tight tracking, no decorative gradient.
- **Linear** (`docs/design-references/linear.DESIGN.md`): tables with hairlines and one action per row, on the light Apple canvas.
- **Oura** (`docs/design-references/oura.DESIGN.md`): cream product page and a single serif headline. The rest of Oura's palette was left behind.
- **Taste Skill** (Leonxlnx/taste-skill, vendored at `.cursor/skills/design-taste-frontend`): one action per screen, no WebGL, no stock shopper photography, real English and Tamil copy, equal edges. The upstream Stop hook that calls Claude was removed from the skill frontmatter. The checker scripts in that repo expect their own starter page, so they were not copied and were not run.
- **Impeccable** (pbakaus/impeccable, vendored at `.cursor/skills/impeccable`): no Inter-everywhere, no purple gradient, no glass, no emoji, no icon tile above every heading. `npx impeccable install` was not run, because that installer registers a Claude agent.

## Impeccable audit

Scored against the five dimensions in `.cursor/skills/impeccable/reference/audit.md` after the screens were built. Scale is 0–4.

| Screen | A11y | Performance | Theming | Responsive | Integrity | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Kiosk | 3 | 4 | 4 | 3 | 4 | Focus ring, large type, one column under 720px. Dwell is 700ms and a click still works. Tamil copy needs a native review. |
| Phone | 3 | 4 | 4 | 3 | 4 | Same shell. No camera step. |
| Staff | 3 | 4 | 4 | 3 | 4 | Table, one blue action. Sign-in is a single continue button. |
| Owner | 3 | 4 | 4 | 3 | 4 | One report. No card grid. |
| Admin | 3 | 4 | 4 | 3 | 4 | Heatmap request is refused in the copy the API returns. |
| Product | 3 | 4 | 4 | 3 | 4 | One serif headline, one order link, no payment, no count. |

No P0 or P1 findings in the store surface. P2: Tamil strings are drafted, not reviewed by a native speaker. P3: the staff style field is a text input rather than a picker.

`scripts/design-audit.mjs` fails the build if store UI introduces a purple hex, a glass blur, an emoji, a pay button, a stock count, or fair/dark skin language.

## This cut

Newsreader and Noto Sans Tamil are files in `src/design/fonts`, loaded with `next/font/local`. Nothing fetches Google Fonts. The skip link stays off screen until it is focused. Catalogue pictures are flat garment drawings in `public/catalog` so every screen has an image with no key. The product page keeps the serif headline and one blue order link.

## Other principle sources

google-labs-code/design.md, Anthropic's frontend-design notes, and OpenAI's Figma design-system notes were read as principles only: hierarchy, restraint, and tokens in one file. Those model integrations were not configured. This build runs on Grok.
