#!/usr/bin/env bash
# Dumps the public schema (every trip, pin, day, flight, eatery), checks the
# dump is readable, then encrypts it. The unencrypted dump never leaves the
# runner. Needs SUPABASE_DB_URL and BACKUP_PASSPHRASE in the environment.
# Usage: scripts/backup-db.sh <output-name>   → writes <output-name>.dump.gpg
set -euo pipefail
out="${1:?output name required}"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL secret is not set}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE secret is not set}"

# A brand-new project (Hanh's Log's own, session 4) has no tables until the
# first migration runs. There's nothing to back up then, so say so and skip
# instead of failing; the workflows skip the upload when empty=true.
tables_now=$(psql "$SUPABASE_DB_URL" -X -t -A -c "select count(*) from information_schema.tables where table_schema = 'public'")
if [ "$tables_now" = "0" ]; then
  echo "Nothing to back up yet: the database has no tables (a brand-new project)."
  [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "Backup skipped: the database has no tables yet (brand-new project)." >> "$GITHUB_STEP_SUMMARY"
  [ -n "${GITHUB_OUTPUT:-}" ] && echo "empty=true" >> "$GITHUB_OUTPUT"
  exit 0
fi

pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --file="$out.dump"

# A dump that pg_restore can't list is not a backup.
tables=$(pg_restore --list "$out.dump" | grep -c ' TABLE DATA ' || true)
if [ "$tables" -lt 1 ]; then
  echo "Backup check failed: the dump contains no table data." >&2
  exit 1
fi
size=$(stat -c %s "$out.dump")

gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" \
  --symmetric --cipher-algo AES256 --output "$out.dump.gpg" "$out.dump"
rm -f "$out.dump"

echo "Backup OK: $tables tables with data, $size bytes before encryption."
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  echo "Backup **$out** OK: $tables tables with data, $size bytes before encryption." >> "$GITHUB_STEP_SUMMARY"
fi
