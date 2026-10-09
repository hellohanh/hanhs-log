#!/usr/bin/env bash
# Applies migrations from supabase/migrations that haven't run yet, in order.
# Each file runs in its own transaction together with the line that records
# it, so a file either fully applies and is recorded, or nothing changes.
# A recorded file whose contents changed afterwards stops everything.
# Usage: scripts/apply-migrations.sh [--dry-run]
set -euo pipefail
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL secret is not set}"
dry_run=false
[ "${1:-}" = "--dry-run" ] && dry_run=true

# psql only substitutes :'variables' in scripts read from a file or stdin,
# never in -c strings, so every query that takes a value goes through stdin.
psql_q() { psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -X -q -t -A "$@"; }

# Bookkeeping lives in its own schema, which the app's API never exposes.
psql_q -c "set client_min_messages = warning;
           create schema if not exists hanhs_log_meta;
           create table if not exists hanhs_log_meta.applied_migrations (
             filename text primary key,
             checksum text not null,
             applied_at timestamptz not null default now());" > /dev/null

summary() { [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "$1" >> "$GITHUB_STEP_SUMMARY" || true; }
summary "### Migrations$([ "$dry_run" = true ] && echo ' (dry run)')"

pending=0
shopt -s nullglob
files=(supabase/migrations/*.sql)   # globs expand in sorted order
for f in "${files[@]}"; do
  name=$(basename "$f")
  sum=$(sha256sum "$f" | cut -d' ' -f1)
  recorded=$(psql_q -v name="$name" -f - <<< "select checksum from hanhs_log_meta.applied_migrations where filename = :'name';")
  if [ -n "$recorded" ]; then
    if [ "$recorded" != "$sum" ]; then
      echo "STOP: $name was already applied but its contents have changed since. Add a new migration instead." >&2
      summary "- ✗ **$name** changed after it was applied — stopped"
      exit 1
    fi
    continue
  fi
  pending=$((pending + 1))
  if [ "$dry_run" = true ]; then
    echo "Would apply: $name"
    summary "- would apply **$name**"
    continue
  fi
  echo "Applying: $name"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -X -q --single-transaction \
    -v name="$name" -v sum="$sum" -v file="$f" -f - <<'SQL'
\i :file
insert into hanhs_log_meta.applied_migrations (filename, checksum) values (:'name', :'sum');
SQL
  summary "- ✓ applied **$name**"
done

[ "$pending" -eq 0 ] && { echo "Nothing to apply."; summary "- nothing pending"; }
exit 0
