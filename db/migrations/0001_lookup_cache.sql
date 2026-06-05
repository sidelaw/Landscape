-- Lookup cache for Regrid responses (Typeahead + Parcel).
-- Keyed by data (not tenant) since parcel facts aren't contractor-specific.
-- Read/written server-side only via the service-role client.

create table if not exists lookup_cache (
  key         text primary key,
  value       jsonb       not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists lookup_cache_expires_at_idx
  on lookup_cache (expires_at);

-- RLS on: no client/anon access. Only the service role (which bypasses RLS)
-- touches this table, so we add no permissive policies.
alter table lookup_cache enable row level security;
