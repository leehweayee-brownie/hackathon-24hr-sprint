# Vendor Passport — design direction

**Who uses it, where:** procurement officers and supplier admins at a desk, mostly on a laptop; the buyer review page is also shown on a projector. Desktop-first, comfortable density, large readable numbers.

**Personality:** verified, precise, calm.

**Reference structure:** Linear (lists + detail), Stripe dashboard (status chips, tables), a document reviewer like DocuSign's field panel.

**Layout:** left sidebar navigation + page header + content. Table/list + detail page. Document viewer: page on the left, fields panel on the right.

## Tokens (see app/globals.css)
- Primary `#1F5EFF` (actions, links, active nav, "the thing that changed"). Used once per screen for the primary action.
- Neutrals: cool grey scale `--color-ink` (#0B0D10) → `--color-surface` (#F7F8FA).
- Semantic only with meaning: success `#16A34A`, warning `#D97706`, danger `#DC2626`, info `#1F5EFF`.
- Type: Inter (headings 600, body 400), tabular numbers for scores and money, Geist Mono-style for IDs/numbers.
- Radius: 8px (cards, inputs), 999px (chips). One shadow level (`--shadow-card`).
- Spacing: 4px scale. Motion: 220ms state changes, 400ms panels, 800ms score ring; `prefers-reduced-motion` respected.

## Rules
- One obvious primary action per screen.
- Status colour = meaning (green/amber/red bands, pipeline chips). No decorative colour.
- AI output is always explainable: value → highlighted source on the page, confidence shown, confirm/correct one click away.
- Motion only on state changes: documents sorting into place, score ring filling, status chips updating.
- Realistic fictional Malaysian content. No emoji icons; Lucide icon set only.
