#!/usr/bin/env bash
# Builds a throwaway copy of the database from the live schema snapshot plus
# our migrations, then runs every tests/db/*.test.sql against it, acting as
# different people. Never touches the live database: it only talks to
# TEST_DB_URL, which must point at a local Postgres.
# Usage: TEST_DB_URL=postgresql://postgres@localhost:5432/postgres tests/db/run.sh
set -euo pipefail
: "${TEST_DB_URL:?set TEST_DB_URL to a LOCAL Postgres}"
case "$TEST_DB_URL" in
  postgresql://*@localhost[:/]*|postgresql://*@127.0.0.1[:/]*) ;;
  *) echo "Refusing: TEST_DB_URL must point at localhost." >&2; exit 1 ;;
esac
cd "$(dirname "$0")/../.."
baseline="${BASELINE:-supabase/baseline/live_public_schema.sql}"
[ -f "$baseline" ] || { echo "Missing $baseline — run the 'Snapshot live schema' workflow first." >&2; exit 1; }

base_url="${TEST_DB_URL%/*}"
tmpl="hl_test_template"
q() { local url="$1"; shift; psql "$url" -X -q -v ON_ERROR_STOP=1 "$@"; }
dbs=("$tmpl")
cleanup() { for d in "${dbs[@]}"; do psql "$TEST_DB_URL" -X -q -c "drop database if exists $d" >/dev/null 2>&1 || true; done; }
trap cleanup EXIT

# 1. Template: Supabase shim → live schema snapshot → our migrations → helpers.
PGOPTIONS="-c client_min_messages=warning" q "$TEST_DB_URL" -c "drop database if exists $tmpl" -c "create database $tmpl"
q "$base_url/$tmpl" -f tests/db/00_supabase_shim.sql > /dev/null
# The snapshot re-creates the public schema, which already exists here.
sed '/^CREATE SCHEMA public;$/d; /^COMMENT ON SCHEMA public /d' "$baseline" | q "$base_url/$tmpl" -f - > /dev/null
SUPABASE_DB_URL="$base_url/$tmpl" scripts/apply-migrations.sh > /dev/null
q "$base_url/$tmpl" -f tests/db/01_test_helpers.sql > /dev/null

# 2. Each test file gets its own fresh copy of the template.
failed=0; passed=0; i=0
for t in tests/db/*.test.sql; do
  i=$((i + 1)); db="hl_test_$i"; dbs+=("$db")
  PGOPTIONS="-c client_min_messages=warning" q "$TEST_DB_URL" -c "drop database if exists $db" -c "create database $db template $tmpl"
  echo "── $(basename "$t")"
  if ! q "$base_url/$db" -f "$t" > /dev/null 2> /tmp/hl_test_err.txt; then
    echo "  ✗ stopped with an error:"; sed 's/^/    /' /tmp/hl_test_err.txt; failed=$((failed + 1))
  fi
  while IFS='|' read -r ok name detail; do
    if [ "$ok" = "t" ]; then echo "  ✓ $name"; passed=$((passed + 1))
    else echo "  ✗ $name${detail:+ — $detail}"; failed=$((failed + 1)); fi
  done < <(psql "$base_url/$db" -X -q -t -A -c "select ok, name, coalesce(detail,'') from test.results order by n")
done

echo
echo "$passed passed, $failed failed"
[ "$failed" -eq 0 ]
