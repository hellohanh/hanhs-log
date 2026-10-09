# Testing

Every pull request runs three checks, and all must be green before merging.

| Check | What it proves | Where |
| --- | --- | --- |
| **checks** | The app builds; migrations follow the database rules | `scripts/check-migrations.mjs` |
| **security-tests** | Who can see and change what: an owner, a stranger, an invited guest (anonymous, like family joining by link) and a signed-out visitor | `tests/db/` |
| **browser-tests** | Each page loads at phone, laptop and laptop-at-150%-zoom sizes, with no errors and no sideways scrolling; saves screenshots | `tests/browser/` |

These exist because of Wanderlog: sharing was broken for months because it
was only ever tested as the owner (L34), a missing permission blocked the
app silently (L3), and a layout bug at 150% zoom took five tries (E87–E92).

## Security tests

`tests/db/run.sh` builds a throwaway database from three pieces:

1. `tests/db/00_supabase_shim.sql`: the small part of Supabase the rules
   depend on (who is signed in), so plain Postgres can stand in for it.
2. `supabase/baseline/live_public_schema.sql`: an exact copy of the live
   database's structure and security rules (no rows). Made by the
   **Snapshot live schema** workflow.
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

## Running locally (optional)

```
npm run test:db       # needs a local Postgres 17; set TEST_DB_URL
npm run build && npm run test:browser
```
