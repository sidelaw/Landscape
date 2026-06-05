# CLAUDE.md — Lawn Care Instant Estimate Widget

## What this is
An embeddable widget for **US** lawn-care businesses. A contractor signs up, sets their pricing, and gets a `<script>` snippet (plus a hosted quote page) for their existing website. A homeowner enters an address, confirms their property on a satellite thumbnail, answers three condition inputs, sees an instant **price range**, and leaves email or phone. Full logic is in **SPEC.md**. The **mockup image** is the visual source of truth.

## TIER 1 — Hard rules (check before every action)
- **Never commit secrets.** Regrid, Stripe, and Google/Mapbox keys live in env vars — never in source or in client-side code. Any call using a secret key is proxied server-side.
- **US-only.** Assume US addresses, parcels, square feet, and USD.
- **No hardcoded prices or coverage %.** All pricing and the coverage bands are config seeded with the SPEC defaults; load them per contractor.
- **Estimates display as a range, never a single number** (e.g. "$73–$94", labelled "subject to on-site confirmation").
- **Validate all input;** handle Regrid / Maps failures gracefully (timeout, no parcel found, ambiguous address).
- **TCPA:** if a phone number is collected, require an explicit SMS-consent checkbox before any text follow-up.
- **Multi-tenant:** every embed is keyed by `data-business-id`. Never let one contractor's config or leads reach another.

## Stack (confirm with me before building — don't assume)
- **Widget:** lightweight, framework-minimal; must embed via one `<script>` tag and render in an isolated container so it can't clash with the host site's CSS.
- **Backend:** [confirm] — accounts, pricing config, lead storage, and a proxy for keyed API calls.
- **Database:** [confirm].
- Do **not** expand the stack or add dependencies without asking.

## Data
- Address autocomplete: **Regrid Typeahead** → parcel id + centroid.
- Lot data: **Regrid Parcel API**, queried by lat/lon (geocode the address to a point first for accuracy).
- Satellite thumbnail: **Google Maps Static API** or **Mapbox Static Images API**, centered on the parcel centroid.

## Workflow
- Use **Plan Mode** for any non-trivial change. Name the files you'll touch and list risks before editing.
- When requirements are unclear, **stop and ask** — don't guess. Pausing is cheap; wrong edits are expensive.
- If reality doesn't match the plan mid-task, **surface it** rather than improvising a new branch of work.

## Out of scope for v1 (don't build unless asked)
Online booking/scheduling, multiple service types (mulch, cleanup), payments beyond an optional Stripe deposit, lawn tracing.
