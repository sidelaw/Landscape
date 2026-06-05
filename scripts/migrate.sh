#!/usr/bin/env bash
# Apply db/migrations/*.sql (in order) to your Supabase Postgres.
#
# Needs SUPABASE_DB_URL — the URI connection string from
#   Supabase → Project Settings → Database → Connection string → URI
# (Use the value with your DB password; the pooler URI on port 5432 works.)
#
# Loads .env.local automatically if present, so after filling it in you can run:
#   npm run db:migrate
set -euo pipefail

if [ -f .env.local ]; then
  set -a; . ./.env.local; set +a
fi

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "✗ Set SUPABASE_DB_URL (Supabase → Project Settings → Database → Connection string → URI)"
  exit 1
fi

for f in db/migrations/*.sql; do
  echo "→ applying $(basename "$f")"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "✓ all migrations applied"
