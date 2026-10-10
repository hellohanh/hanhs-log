# Testing

Every pull request runs three checks, and all must be green before merging.

| Check | What it proves | Where |
| --- | --- | --- |
| **checks** | The app builds; migrations follow the database rules | `scripts/check-migrations.mjs` |
| **security-tests** | Who can see and change what: an owner, a stranger, an invited guest (anonymous, like family joining by link) and a signed-out visitor | `tests/db/` |
| **browser-tests** | Each page loads at phone, laptop, laptop-at-150%-zoom and 2560 × 1440 monitor sizes, with no errors and no sideways scrolling; the Wanderlog screens work when signed in; saves screenshots | `tests/browser/` |

These exist because of Wanderlog: sharing was broken for months because it
was only ever tested as the owner (L34), a missing permission blocked the
app silently (L3), and a layout bug at 150% zoom took five tries (E87–E92).

## Security tests

`tests/db/run.sh` builds a throwaway database from three pieces:

1. `tests/db/00_supabase_shim.sql`: the small part of Supabase the rules
   depend on (who is signed in), so plain Postgres can stand in for it.
2. `supabase/baseline/live_public_schema.sql`: empty since session 4.
   Hanh's Log's own project starts with nothing and the migrations build
   everything. (Before, it was a copy of Wanderlog's structure, made by the
   **Snapshot live schema** workflow; that copy is in
   `supabase/archive/wanderlog-db/`.)
3. `supabase/migrations/`: our changes, applied on top.

Each `tests/db/*.test.sql` file then acts as different people and records
pass or fail. The live database is never touched; the script refuses any
address that isn't `localhost`.

**Rule:** every migration that adds a table or changes who can access
something comes with a test here showing that a stranger can't see it and an
invited member can.

## Browser tests

Pages are listed at the top of `tests/browser/smoke.spec.ts`; every page is
opened at all three sizes. **Rule:** a new screen gets a line there in the
same pull request. Screenshots appear under the run's **Artifacts**
(`screenshots`), handy for checking sizes you don't have in front of you.

## Signed-in screens without the live database

The test build points at a stand-in Supabase address
(`https://test-project.supabase.co`, set in `ci.yml`). Tests such as
`tests/browser/wander.spec.ts` pretend to be signed in and answer every
database call themselves, so they can check the signed-in screens
(trip cards, creating and deleting a trip) without touching live data.
Who is *allowed* to see or change what is still proven by the security
tests above, against the real rules.

## Running locally (optional)

```
npm run test:db       # needs a local Postgres 17; set TEST_DB_URL
BASE_PATH=/ VITE_SUPABASE_URL=https://test-project.supabase.co VITE_SUPABASE_ANON_KEY=test-anon-key npm run build
npm run test:browser
```
