# Wanderlog database: Hanh's Log's old migrations (archived)

Until session 4, Hanh's Log shared live Wanderlog's Supabase database.
These three migrations ran there:

| File | What it did |
|---|---|
| 0001_trip_people.sql | First names, people list, owner remove/reset, owner/invite guard |
| 0002_trip_city.sql | City columns on trips for the map |
| 0003_remove_hanhs_log_from_wanderlog.sql | Removed everything 0001 and 0002 added, giving Wanderlog's database back as it was |

In session 4 Hanh decided Hanh's Log gets its own, new Supabase project and
builds its trips from scratch, leaving live Wanderlog untouched. The files
are kept here, unchanged, as the record of what ran on Wanderlog's database.
`wanderlog_public_schema.sql` is the last snapshot of Wanderlog's schema.
Their tests are in `tests/db/archive-wanderlog/` (not run).

Nothing in this folder is ever applied again. The migrations workflow only
reads `supabase/migrations/`.
