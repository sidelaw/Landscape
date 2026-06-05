-- Leads, funnel analytics, and the optional Stripe deposit toggle.

-- ── Leads ─────────────────────────────────────────────────────────────────────
create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name        text,
  email       text,
  phone       text,
  -- TCPA: SMS follow-up requires explicit consent; we store the flag + when.
  sms_consent boolean not null default false,
  consent_at  timestamptz,
  quote       jsonb not null,   -- { kind, low, high, display, needsManualReview }
  inputs      jsonb not null,   -- lot + condition inputs that produced the quote
  lot_source  text,             -- regrid | manual | mock
  status      text not null default 'new',
  created_at  timestamptz not null default now()
);
create index if not exists leads_business_created_idx
  on leads (business_id, created_at desc);

alter table leads enable row level security;

-- Owner can read/update leads belonging to their business. Inserts happen
-- server-side via the service-role client (the public widget is unauthenticated),
-- so there is intentionally no anon INSERT policy.
drop policy if exists "owner reads own leads" on leads;
create policy "owner reads own leads" on leads
  for select using (
    exists (select 1 from businesses b where b.id = leads.business_id and b.owner_id = auth.uid())
  );

drop policy if exists "owner updates own leads" on leads;
create policy "owner updates own leads" on leads
  for update using (
    exists (select 1 from businesses b where b.id = leads.business_id and b.owner_id = auth.uid())
  );

-- ── Funnel analytics ──────────────────────────────────────────────────────────
create table if not exists analytics_events (
  id          bigserial primary key,
  business_id uuid not null references businesses(id) on delete cascade,
  event       text not null,    -- address_entered | property_confirmed | quote_shown | custom_quote_routed | lead_captured | regrid_fallback
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists analytics_events_business_event_idx
  on analytics_events (business_id, event);

alter table analytics_events enable row level security;
drop policy if exists "owner reads own events" on analytics_events;
create policy "owner reads own events" on analytics_events
  for select using (
    exists (select 1 from businesses b where b.id = analytics_events.business_id and b.owner_id = auth.uid())
  );

-- ── Optional Stripe deposit (off by default) ──────────────────────────────────
alter table businesses add column if not exists deposit_enabled boolean not null default false;
alter table businesses add column if not exists deposit_amount_cents integer not null default 0;
