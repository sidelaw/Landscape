-- Contractor accounts (tenants) + pricing config + embed allowlist.
-- Multi-tenant isolation is enforced by RLS: an authenticated contractor can
-- only see/edit their own business row. The server-side service-role client
-- (which bypasses RLS) is used for the widget's public, proxied reads.

create table if not exists businesses (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  name               text not null default 'My Lawn Care',
  notification_email text,
  -- Full PricingConfig (SPEC §5) as JSONB. The app supplies the SPEC defaults
  -- on creation (lib/config.ts is the single source of truth — no defaults are
  -- duplicated here), then the contractor tunes it from the dashboard.
  pricing            jsonb not null,
  -- Origin allowlist for the embed (enforced on metered endpoints in M5).
  allowed_domains    text[] not null default '{}',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- v1: one business per owner.
create unique index if not exists businesses_owner_id_key on businesses (owner_id);

-- keep updated_at fresh
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists businesses_set_updated_at on businesses;
create trigger businesses_set_updated_at
  before update on businesses
  for each row execute function set_updated_at();

-- Row-Level Security: owner-only access. Service role bypasses RLS for the
-- widget's server-side public-config reads.
alter table businesses enable row level security;

drop policy if exists "owner can read own business" on businesses;
create policy "owner can read own business" on businesses
  for select using (auth.uid() = owner_id);

drop policy if exists "owner can insert own business" on businesses;
create policy "owner can insert own business" on businesses
  for insert with check (auth.uid() = owner_id);

drop policy if exists "owner can update own business" on businesses;
create policy "owner can update own business" on businesses
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
