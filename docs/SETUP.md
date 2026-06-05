# Live setup & verification

This wires the app to real services and verifies the full flow end-to-end.
Everything runs in graceful "demo mode" without these — this is only needed to
exercise the **persisted** paths (auth, leads, email, deposits).

## 1. Create accounts & collect keys

Fill `.env.local` (copy from `.env.example`). Minimum for the core checks is
**Supabase**; the rest are optional and unlock their own checks.

| Service | Env vars | Where |
|---|---|---|
| **Supabase** (required) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project → Settings → **API**. `SUPABASE_URL` = the same Project URL. |
| Supabase DB (for migrations) | `SUPABASE_DB_URL` | Settings → **Database** → Connection string → **URI** (includes your DB password) |
| Regrid | `REGRID_API_TOKEN` | regrid.com account → API token |
| Google Maps | `GOOGLE_MAPS_API_KEY` | Google Cloud → enable **Maps Static API** → API key |
| Resend | `RESEND_API_KEY`, `LEAD_FROM_EMAIL` | resend.com → API key + a verified sender |
| Stripe | `STRIPE_SECRET_KEY` | Stripe (use a **test** key, `sk_test_…`) |

> Never commit `.env.local` — it's gitignored.

## 2. Apply the database schema

```bash
npm run db:migrate
```

Runs `db/migrations/0001…0003` against `SUPABASE_DB_URL` with `psql`
(idempotent — safe to re-run). Creates `lookup_cache`, `businesses`, `leads`,
`analytics_events`, the RLS policies, and the deposit columns.

## 3. Run the app

```bash
npm run build
npm run start      # Next.js loads .env.local automatically
```

Visit:
- `/` — widget demo
- `/login` → `/dashboard` — create an account, set pricing, copy the embed snippet
- `/q/<businessId>` — hosted quote page

## 4. Automated live verification

With the app running, in another shell:

```bash
npm run verify:live
```

It creates two throwaway users + a business, then checks (and cleans up):

- **Schema** present (all tables)
- **RLS isolation** — a second tenant cannot read or update another's business
- **/api/config**, **/api/quote** ($73 – $94)
- **/api/lead** actually persists to `leads`
- **TCPA** — phone without consent is rejected (400)
- **/api/event** persists a funnel event
- **Regrid** live typeahead (if key) — real results, `mock:false`
- **Google Maps** live satellite image (if key) — real `image/*`, not the SVG placeholder
- **Stripe** checkout session created (if test key)
- **Resend** configured (if key + `VERIFY_EMAIL_TO`)

Exit code is non-zero if anything fails, with a per-check PASS/FAIL/SKIP report.

## 5. Deploy to Vercel

The repo ships a `vercel.json` that sets the **Build Command** to `npm run build`.
This is required: Vercel's default Next.js build (`next build`) does **not** run
`widget/build.mjs`, and `/public/embed` is gitignored — so without this override
the embeddable `/embed/widget.js` bundle is never generated and the widget fails
to load on the demo page, the hosted `/q` page, and every contractor embed.

Set the same environment variables from §1 in **Vercel → Project → Settings →
Environment Variables** (Production + Preview). Restarting the Claude Code
session only loads keys into the sandbox — it does **not** configure Vercel.
Minimum for a working frontend:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `REGRID_API_TOKEN`, `GOOGLE_MAPS_API_KEY` (live address + satellite paths)
- optional: `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `LEAD_FROM_EMAIL`

Then deploy (CLI: `vercel --prod`, or connect the repo in the Vercel dashboard).
Point `verify:live` at the deployment with `APP_URL=https://<your-app> npm run
verify:live` to confirm the live endpoints end-to-end.

## Notes
- Supabase **Auth → Email**: for the dashboard sign-up flow, either disable
  "Confirm email" for testing, or confirm via the emailed link. The automated
  verifier bypasses this by creating users with the admin API.
- The in-process rate limiter is best-effort on serverless; for production back
  it with Redis/Upstash.
