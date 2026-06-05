# Lawn Care Instant Estimate — v1 Spec (Build-Ready)

**Scope:** US only. A homeowner enters an address → confirms their property via a satellite thumbnail → answers 3 condition inputs → sees an instant price *range* → leaves email or phone to proceed. Each contractor sets their own pricing. No lawn tracing.

**Product shape:** an **embeddable widget** for US lawn-care businesses. A contractor signs up, sets pricing, and gets a `<script data-business-id="…">` snippet plus a hosted quote page for their site. Multi-tenant: every embed is keyed by `data-business-id` and no contractor's config or leads may reach another.

**Data source:** Regrid (Typeahead API + Parcel API). Satellite imagery: Google Maps Static API.

**Out of v1 scope:** online booking/scheduling, multiple service types (mulch, cleanup, etc.), payments beyond an optional Stripe deposit, lawn tracing.

> The uploaded **mockup image is the visual source of truth** for the widget UI (dark panel, green accents, single compact card).

---

## 0. Architecture & stack (decided)

| Layer | Choice | Notes |
|---|---|---|
| **Widget** | **Preact + Shadow DOM** | A small bootstrap `<script>` mounts a Shadow DOM root and renders a Preact app inside it. Full CSS isolation from the host site; reactive sliders + live SVG are cheap. Target a lean gzipped bundle. |
| **App / backend** | **Next.js (App Router) on Vercel** | One repo: contractor dashboard (React) + API route handlers (Regrid/Maps proxy, pricing config, leads, analytics) + the widget build output. Serverless functions; edge-cacheable where safe. |
| **Database** | **Postgres (Supabase)** | Multi-tenant isolation via **Row-Level Security**. Also stores the Regrid lookup cache and first-party analytics events. |
| **Auth** | **Supabase Auth** | Email/password + magic link + Google OAuth for contractors. Sessions map to a `business` (tenant) via RLS. |
| **Email** | **Resend** | Contractor lead notifications and any auth/transactional mail (React Email templates). |
| **Payments** | **Stripe** | Optional deposit only, off by default, wired in the final milestone. |
| **Validation** | **zod** (shared client+server) + **libphonenumber-js** | Server always re-validates. |

### Repository layout (single repo)
```
/app            # Next.js App Router — dashboard pages + /q/[businessId] hosted page
/app/api        # route handlers: typeahead, parcel, static-image, quote, lead, config, analytics
/widget         # Preact widget source → built to a single embeddable bootstrap script
/lib            # estimate engine, regrid client, maps client, zod schemas, supabase clients
/db             # SQL migrations / RLS policies / seed defaults
/public/embed   # built widget bootstrap (served as the <script> src)
```

### Secret handling (TIER 1)
- **Regrid, Google Maps, Stripe, Resend, Supabase service-role keys live only in server env vars.** Never in source, never in the client bundle, never returned to the browser.
- **Every keyed call is proxied** through `/app/api/*` route handlers. The widget only ever talks to our own first-party endpoints.
- The widget bundle is fully public; it must contain **no secrets** — only the public `business-id` (supplied by the host page) and our API base URL.

---

## 1. Property lookup + satellite thumbnail

1. **Address autocomplete** via our `/api/typeahead` proxy → Regrid Typeahead → returns parcel id + **centroid (lat/lon)** + display address.
2. **Parcel data** via `/api/parcel` proxy → Regrid Parcel API queried **by the Typeahead centroid lat/lon** (no separate geocoder in v1) → returns lot area (sqft / acres), `struct` (structure present?), parcel polygon (GeoJSON).
3. **Satellite thumbnail** via `/api/static-image` proxy → **Google Maps Static API**, `maptype=satellite`, ~zoom 19–20, ~600×400, pin on centroid. Optional polish: overlay the parcel polygon path.
4. **UX:** show the image with **"Is this your property?"** → **Yes** (continue) / **No** (re-enter address). **Block the quote until confirmed.**

### Caching (decided: persist in Postgres)
- Cache Typeahead and Parcel responses in Postgres keyed by parcel id / normalized address, **TTL ~30 days**. Parcel data rarely changes; this cuts Regrid spend and provides resilience when Regrid is slow/down.
- Cache is keyed by data, **not** by tenant (parcel facts are not contractor-specific), but cache reads/writes happen server-side only.

### Failure handling (decided: manual-entry fallback — never dead-end a lead)
- **No parcel match:** let the homeowner proceed by entering lot size manually (or accept a sensible default), flagged `lot_source = "manual"` / `unverified`. Still show the satellite image of the typed location for the Yes/No confirm where possible.
- **Timeout / 5xx:** retry once with backoff, then fall back to the manual-entry path.
- **Rate-limit (429):** serve from cache if available; otherwise manual-entry fallback. Log the event.
- Always surface a clear, friendly message; never block the homeowner from reaching the lead-capture step.

---

## 2. Coverage ratio (lot size → mowable turf)

Lot size ≠ lawn — house, driveway, patio, and beds aren't mowed. v1 estimates turf as a % of lot size, banded.

> ⚠️ **These percentages are starting assumptions, not measured values. Calibrate them against real completed jobs after launch — this is the single number that most affects accuracy.**

| Lot size (sqft) | Assumed turf coverage |
|---|---|
| under 3,000 | 50% |
| 3,000 – 7,499 | 60% |
| 7,500 – 14,999 | 65% |
| 15,000 – 43,560 (≤ 1 acre) | 70% |
| over 43,560 (> 1 acre) | 55% **+ flag for manual review** |

- If Regrid `struct = false` (no building on parcel), bump coverage to ~80% (likely an open lot).
- **v2 accuracy path:** a higher Regrid tier includes building footprints → then `turf ≈ lot − footprint − hardscape estimate`, removing the banding guess.

```
turf_sqft = lot_sqft × coverage_ratio
```

---

## 3. Price formula
```
raw    = (turf_sqft / 1000) × base_rate_per_1000
adj    = raw × last_cut_mult × obstruction_mult × terrain_mult
if recurring:  adj = adj × (1 − recurring_discount_pct / 100)
price  = max(adj, minimum_charge)

if price > auto_quote_cap:
    → don't show a number; route to the custom-quote path (below)
else:
    low    = max(price × (1 − range_low%), minimum_charge)   # never advertise below the minimum
    high   = price × (1 + range_high%)
    range  = [low, high]
```
**Display a range, never a single number** — coverage from lot size is approximate. Show e.g. "**$73 – $94**" with the label *"estimate, subject to on-site confirmation."*

**High quotes go to a human.** If `price` exceeds `auto_quote_cap` (default **$300**), don't show a figure — display *"This property needs a custom quote"* and capture the lead's contact (§6) for follow-up. Compounded multipliers on large or neglected lots can otherwise produce unrealistic numbers that scare off real leads.

> The estimate engine is a **pure, server-side function** (`/lib/estimate`). The widget displays what the server computes; price math is never trusted to the client.

---

## 4. Condition multipliers (defaults — contractor-tunable)

**Last cut** (dropdown):

| Option | Multiplier |
|---|---|
| Within a week | 1.0 |
| 2–3 weeks | 1.15 |
| About a month | 1.4 |
| 2–3 months | 1.8 |
| 6+ months / "a jungle" | 2.75 |

**Obstructions** (slider, none → a lot): interpolate `1.0 → obstruction_multiplier_max` (default **1.35**).

**Ground level** (slider, flat → small hills): interpolate `1.0 → terrain_multiplier_max` (default **1.20**).

---

## 5. Contractor pricing config
Set at signup. **Defaults are pre-filled so a contractor can launch without configuring anything**, then tune.

| Field | Type | Default | Notes |
|---|---|---|---|
| `base_rate_per_1000_sqft` | $ | 7.00 | Reproduces the ~$50 US avg for a ¼-acre lawn |
| `minimum_charge` | $ | 45 | Floor for small lots / show-up cost |
| `last_cut_multipliers` | map | (§4 table) | Per option |
| `obstruction_multiplier_max` | × | 1.35 | Slider max |
| `terrain_multiplier_max` | × | 1.20 | Slider max |
| `recurring_discount_pct` | % | 15 | Applied if recurring checked |
| `range_low` / `range_high` | % | 10 / 15 | Display spread |
| `auto_quote_cap` | $ | 300 | Above this, show "custom quote" + capture the lead instead of a number |
| `coverage_overrides` | map | system bands (§2) | Advanced; optional |

- **No hardcoded prices or coverage %** anywhere (TIER 1). Every business row is seeded with these defaults at creation; the engine loads config **per contractor** by `business-id`.

---

## 6. Lead capture & delivery
- Show the estimate range **first** (instant gratification), then capture contact at the CTA (**"Lock in this price"** / **"Request service"**).
- Require **at least one of email or phone**; name optional.
- **US phone** parsed/validated with **libphonenumber-js**. If a phone number is given, show an explicit **SMS-consent checkbox (TCPA)** — no text follow-up without it. Store the consent flag + timestamp.
- **Anti-spam:** honeypot field + per-IP / per-business rate limiting on the lead endpoint.
- On submit, store the lead + the quote + all inputs against the contractor's account (tenant-isolated via RLS).

### Delivery channels (decided: dashboard + email)
- **Dashboard inbox:** a per-contractor leads list showing every input, the computed range, lot source (verified/manual), and consent state. Always built.
- **Email notification:** send the contractor an email (Resend) on each new lead, to their configured notification address.
- *Out of v1:* outbound webhook and CSV export (note as fast-follow; schema should not preclude them).

### Data & privacy
- Homeowner PII (email/phone/name/address) is stored per-tenant in Postgres with RLS so only the owning contractor (and our service role) can read it.
- Keep a minimal lead record; do not expose PII through any public/widget endpoint.

---

## 7. Worked example
¼-acre lot (10,890 sqft), has a house, cut **about a month ago**, **moderate obstructions** (~50% slider), **flat**:
- turf = 10,890 × 65% = **7,079 sqft**
- raw = 7.079 × $7 = **$49.55**
- × 1.4 (last cut) × 1.18 (obstructions) × 1.0 (terrain) = **$81.8**
- not recurring; above $45 min
- **Display ≈ $73 – $94**

*Same lawn, maintained + recurring:* 7.079 × $7 × 1.0 × 1.18 × 1.0 = $58.5, × 0.85 = $49.7 → **≈ $45 – $57**.

---

## 8. Frontend / UX
**The uploaded mockup is the visual source of truth** (dark panel, green accents, single compact card).

**Layout — single card, top to bottom:**
1. Address field (Regrid Typeahead autocomplete, via our proxy).
2. Satellite thumbnail + **"Is this your property?"** Yes / No (§1).
3. **Obstructions** slider — None → A lot.
4. **Ground level** slider — Flat → Small hills.
5. Reactive landscape illustration (below).
6. **When was it last cut?** dropdown (§4 options).
7. **"Add recurring lawn care (15% off)"** checkbox.
8. **Get quote** button (green, full-width).
9. Estimate range appears inline → then contact capture, email or phone (§6).

**Reactive landscape illustration** — an inline SVG scene that updates live as inputs change:
- The house stays fixed (it's their property).
- **Last cut** drives grass height/density: within a week = short and neat → about a month = longer, patchier → 6+ months / "a jungle" = tall and overgrown.
- **Obstructions** slider drives how many trees/shrubs/objects appear: none → many.
- **Ground level** slider morphs the ground from flat → rolling hills.
- Keep it lightweight (inline SVG, no heavy assets) — it ships inside the embed.

> The illustration is a **trust/clarity device only** — it does **not** feed the price. The §3–4 inputs drive the number directly; the scene just mirrors them so the homeowner sees their yard reflected.

### Accessibility (decided: best-effort basics)
- Proper labels and semantic elements for every control; native or ARIA-labeled slider/dropdown.
- Full keyboard operability and visible focus states.
- Color is never the sole signal for state (the mockup's green accents are paired with text).
- *Not formally targeting WCAG 2.1 AA in v1* (live-regions / reduced-motion are nice-to-have, not required), but don't regress the basics above.

---

## 9. Embed, hosted page & multi-tenant security

### Embed mechanism (decided: script snippet + hosted page)
- **Inline embed:** a one-line `<script src="…/embed.js" data-business-id="…"></script>` snippet. The bootstrap reads `data-business-id`, creates a container, attaches a Shadow DOM root, and mounts the Preact widget. One shared widget bundle powers all tenants.
- **Hosted quote page:** `/q/[businessId]` renders the same widget standalone — a shareable link / QR target for contractors without a website.
- The widget fetches the contractor's **public** config (display-safe fields only) and submits quotes/leads through our proxied API, scoped by `business-id`.

### Abuse protection on metered endpoints (decided: domain allowlist + rate limit)
`business-id` is public in the snippet, and Regrid/Maps calls cost money. Therefore:
- Each business sets an **allowed-domains** list in the dashboard. The proxy endpoints (`/api/typeahead`, `/api/parcel`, `/api/static-image`, `/api/quote`) check the request **Origin** against that business's allowlist and reject mismatches. (The hosted `/q/[businessId]` page is implicitly allowed.)
- **Per-IP and per-business-id rate limiting** on all metered endpoints.
- Combined, this stops a leaked `business-id` from being embedded elsewhere to run up the owner's API bill.

---

## 10. Analytics (decided: first-party funnel in Postgres)
- Record funnel events server-side, tenant-scoped:
  `address_entered → property_confirmed → quote_shown → lead_captured` (plus `custom_quote_routed`, `regrid_fallback`).
- Surface per-contractor **conversion stats** in the dashboard (views → quotes → leads).
- No third-party analytics vendor in v1 (privacy-friendly, no extra script in the embed).

---

## 11. Build milestones (in order)
Build in **Plan Mode**, one milestone at a time. Each milestone names its files and risks before editing.

1. **Property lookup** — Regrid Typeahead + Parcel proxy (centroid query), Postgres cache, manual-entry fallback, Google Static satellite thumbnail + Yes/No confirm.
2. **Estimate engine** — pure server-side coverage ratio → price formula → range, with per-contractor config + the §2/§4/§5 defaults. Unit-tested against the §7 worked example.
3. **Reactive widget UI** — Preact + Shadow DOM card matching the mockup: sliders, dropdown, recurring checkbox, live landscape SVG, inline range display.
4. **Contractor accounts + pricing config** — Supabase Auth, tenant `business` rows, RLS, dashboard pricing/config screen seeded with defaults, allowed-domains setting.
5. **Embed snippet + hosted page** — `embed.js` bootstrap (`data-business-id`), `/q/[businessId]` route, Origin allowlist + rate limiting, public-config endpoint.
6. **Lead capture + optional Stripe deposit** — lead storage (RLS), dashboard inbox, Resend notification, TCPA consent gating, funnel analytics; optional Stripe deposit toggle (off by default).

---

## 12. Project rules (from CLAUDE.md — always in force)
- **Never commit secrets.** Keys in env vars; every keyed call proxied server-side.
- **US-only:** US addresses, parcels, square feet, USD.
- **No hardcoded prices or coverage %;** load per-contractor config seeded with these defaults.
- **Estimates display as a range, never a single number,** labelled "subject to on-site confirmation."
- **Validate all input;** handle Regrid/Maps failures gracefully (timeout, no-match, ambiguous, 429).
- **TCPA:** phone collected ⇒ explicit SMS-consent checkbox before any text follow-up.
- **Multi-tenant:** every embed keyed by `data-business-id`; never leak one contractor's config or leads to another.
- Use **Plan Mode** for non-trivial changes; name files + risks first. When unclear, **stop and ask**. Don't expand the stack or add dependencies without asking.
