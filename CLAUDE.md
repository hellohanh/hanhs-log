# Working agreement for Hanh's Log

- Every change goes on a branch and through a pull request; never push to main.
  The PR description says what changed and what to check on the preview link.
- Run `npm run build` before every push; a failing build is never pushed.
- Visual or interaction changes need a mockup the user approves before code.
- Database changes only as numbered migration files; never hand over a full
  schema to run. Every new table ships with its GRANTs and RLS policies together.
- Never put API keys or secrets in code or chat; they live in GitHub
  Settings → Secrets.
- Wanderlog's decision log and lessons (hanhs-wanderlog repo, SKILL.md) are
  the reference for past pitfalls; check them before re-solving a known problem.
