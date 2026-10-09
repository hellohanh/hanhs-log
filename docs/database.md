# Database rules

Hanh's Log shares the **same Supabase project as Wanderlog**, so every change
here touches live trips. These rules exist because of real Wanderlog
incidents: data wiped twice by re-running a full schema (L10, L21), tables the
app couldn't read because a GRANT was missing (L3, L20), sharing that silently
failed for months because a policy was missing (L34), and migrations nobody
could confirm had ever run.

## The rules

1. **Changes only as numbered migration files** in `supabase/migrations/`:
   `0001_create_eateries.sql`, `0002_…`. No full schema file is ever run.
2. **A merged migration is never edited or deleted.** Fix it with a new one.
3. **Every new table, in the same file:** `enable row level security`, at
   least one `create policy`, and a `grant` to `authenticated`.
4. **Nothing destructive** (`drop table`, `drop column`, `truncate`,
   `delete from`, `drop policy`) unless the file has a line
   `-- allow-destructive: <reason>` and you approved it.
5. **Migrations run only through the workflow**, never by pasting SQL into
   the Supabase editor. Then the record of what ran stays complete.

`scripts/check-migrations.mjs` enforces 1–4 on every pull request; the PR
can't go green until they pass.

## How a migration reaches the live database

1. Claude adds the file in a pull request; the checks run.
2. You merge it.
3. The **Database migrations** workflow starts and **waits for your
   approval** (GitHub emails you; open the run and click *Review deployments
   → Approve*).
4. It takes a fresh encrypted backup, then applies each new file in its own
   transaction and records it in `hanhs_log_meta.applied_migrations`. If a
   file fails, that file is rolled back completely and the run stops.

To see what *would* run without changing anything: Actions → Database
migrations → Run workflow → leave **dry run** ticked.

## Backups

- **Nightly** at 3:17am Chicago (2:17am in winter): Actions → Nightly
  database backup. Kept 30 days.
- **Before every migration:** kept 90 days.
- Each is the `public` schema (all trips, pins, days, flights, eateries),
  checked readable, then encrypted with `BACKUP_PASSPHRASE`. Without that
  passphrase a backup can't be opened, so keep it in your password manager.
- Login accounts (Supabase `auth`) are not in the backup; Supabase keeps
  those itself.

## Seeing what's in the live database

Actions → Inspect database → Run workflow. The run's summary page lists every
table, whether row-level security is on, its policies and grants, and which
Hanh's Log migrations have run. It never reads row data.

## Restoring a backup (rarely needed; ask Claude to walk through it)

1. Download the artifact from the backup run and unzip it.
2. Decrypt:
   `gpg --pinentry-mode loopback -d nightly-YYYY-MM-DD.dump.gpg > backup.dump`
3. Restore into a **new, empty** database first and check it, never straight
   over the live one:
   `pg_restore --no-owner --no-privileges -d "<that database's URL>" backup.dump`
   (one ignorable warning: `schema "public" already exists`).

## One-time setup (secrets and approval)

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Supabase dashboard → **Connect** → **Session pooler** URI, with your database password filled in. The session pooler is needed because GitHub's runners can't reach the direct connection. |
| `BACKUP_PASSPHRASE` | A long passphrase you make up and save in your password manager. |

Never paste either value into chat or code.

Then **Settings → Environments → New environment** named `production-db`,
tick **Required reviewers**, add yourself, and save. That's what makes
migrations wait for your approval.

## New-table template

```sql
create table if not exists public.example (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.example enable row level security;
grant select, insert, update, delete on public.example to authenticated;
create policy "owner reads and writes" on public.example
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
```
