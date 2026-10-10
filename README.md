# Hanh's Log

One app for trip planning (**Wanderlog**) and eateries (**Savorlog**), sharing one
login and one database. Live at https://hellohanh.github.io/hanhs-log/

## Current state (after Session 1, OCT 9 2026)

| Milestone | Status |
|---|---|
| M1 Foundation: design tokens, light and dark mode, header, routes, email sign-in, add to home screen | ✅ live |
| M2 Splash: scroll-driven plane flight, hand-over to the painted plane, search and section panels, city search page | ✅ live (desktop); phone layout parked |
| M3 Wanderlog trips and map inside Hanh's Log | ⏭ next |
| M4 Savorlog (country → main dish) | planned |
| M5 Savorlog pins on trips, by city (20 km) | planned |
| M6 Wanderlog itinerary | planned |
| M7 Switch over from the old Wanderlog | planned |

## What's built
- **Splash (`/`)**:
  - Hanh's watercolor hero in a 1080 × 800 container.
  - Scrolling flies the plane along the dotted route Hanh mapped.
  - At the end the flying plane hands over to the plane painted in the picture, and the search panel, Where to? section, and Wanderlog and Savorlog cards fade in.
  - With reduced motion, the page shows the finished picture straight away.
- **City search (`/search?city=…`)**: one results page per city, with trips and eateries sections that fill in at M3 and M4.
- **Wanderlog (`/wander`) and Savorlog (`/savor`)**: placeholder pages until M3 and M4.
- **Sign in (`/signin`)**: email link through Supabase, the same project as Wanderlog.
- **Safety net**:
  - every pull request gets a preview link, a build check, migration rules, two-person security tests and browser tests at phone, laptop and 150% zoom;
  - database changes run only through the approval-gated migrations workflow, after a backup;
  - backups run nightly, encrypted.

## What's next
Milestone 3. First lay out its checklist (from today's Wanderlog features) for Hanh to approve, then build it in small pull requests.

## Resume prompt
> We're continuing Hanh's Log (repo hellohanh/hanhs-log, live at hellohanh.github.io/hanhs-log).
> Read SKILL.md (E1–E22, L1–L13), README.md and SESSION_LEDGER.md first, plus CLAUDE.md for
> the working agreement. Session 1 finished M1 and M2 (desktop). Start Session 2 with the
> milestone 3 checklist (Wanderlog trips and map) for my approval. Ask me decisions as tappable
> multiple-choice questions.

## Working agreement
- Every change goes on a branch and through a pull request; never push to main.
- Run `npm run build` before every push.
- All checks must be green before Hanh is asked to merge.
- Visual changes need a mockup or preview Hanh approves first.
- Database changes only as numbered migrations, applied by the approval-gated workflow. Never hand over SQL to paste. The database is shared with live Wanderlog.
- Keys and secrets live only in GitHub Settings → Secrets.
- Decisions are asked as tappable multiple-choice questions; nothing is inferred.
- Each session ends with the Stop Protocol (see SKILL.md):
  - update SKILL.md, README.md and SESSION_LEDGER.md;
  - make sure the build is clean;
  - produce a numbered zip.

## How changes ship
1. Claude commits each change to a branch and opens a pull request.
2. The PR gets a preview link (a comment from the preview bot) at
   `https://hellohanh.github.io/hanhs-log/pr-preview/pr-<number>/`.
   Check it on your phone and laptop.
3. Click **Merge** (use "Create a merge commit"). The live site updates in about two minutes.

Git history is the full record. A zip snapshot is also made at each Stop Protocol.

## Database
The database is shared with Wanderlog, so it has its own rules, nightly
encrypted backups and an approval step before any change runs. See
[docs/database.md](docs/database.md).

## Tests
Every pull request runs:
- security tests, covering the owner, a stranger, an invited guest and a signed-out visitor;
- browser tests at phone, laptop and 150% zoom.

See [docs/testing.md](docs/testing.md).

## Running it on your own computer (optional)
```
npm install
npm run dev
```
Keep the folder on a local drive, in a path with no apostrophes or other quote
characters (see Wanderlog lesson L37).
