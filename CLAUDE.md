# Working agreement for Hanh's Log

- Every change goes on a branch and through a pull request; never push to main.
  The PR description says what changed and what to check on the preview link.
- Run `npm run build` before every push; a failing build is never pushed.
- Visual or interaction changes need a mockup the user approves before code.
- Database changes only as numbered migration files in supabase/migrations,
  applied by the "Database migrations" workflow; never hand over SQL to paste
  into Supabase. Rules and template: docs/database.md (enforced by
  scripts/check-migrations.mjs). Hanh's Log has its own Supabase project; never
  touch live Wanderlog's site or database.
- Tests (docs/testing.md): a migration that adds a table or changes access
  comes with a tests/db test (stranger can't see it, invited member can);
  a new screen gets a line in tests/browser/smoke.spec.ts. All PR checks
  must be green before asking the user to merge.
- Never put API keys or secrets in code or chat; they live in GitHub
  Settings → Secrets.
- Wanderlog's decision log and lessons (hanhs-wanderlog repo, SKILL.md) are
  the reference for past pitfalls; check them before re-solving a known problem.
