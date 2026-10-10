# SKILL.md — Hanh's Log

Source of truth for Hanh's Log. **E-numbers** are locked decisions, **Q-numbers** are open
questions, **L-numbers** are lessons. Wanderlog's own SKILL.md (hanhs-wanderlog repo, E1–E106,
L1–L37+) is the reference for older pitfalls. Check it before re-solving a known problem.

## Project Overview
Hanh's Log is one web app that holds **Wanderlog** (trips: maps, pins, day-by-day itineraries,
shared with co-travelers) and **Savorlog** (eateries, organised by country, then main dish).
Savorlog pins appear automatically on any Wanderlog trip **by city** (a Rome trip shows only
Rome eateries). Later sections may be added. It is rebuilt from the ground up with a modern,
MICHELIN-Guide-style look, using today's Wanderlog features as the checklist. It shares the
live Wanderlog database.

## Architecture
- **Front end:** React 18 + Vite 5 + TypeScript (strict), react-router-dom v6, CSS Modules plus design tokens (`src/styles/tokens.css`), and vite-plugin-pwa ("add to home screen").
- **Hosting:** GitHub Pages at https://hellohanh.github.io/hanhs-log/. Deployed from the `gh-pages` branch by `deploy.yml` on every merge to `main`. Each pull request gets a preview at `/hanhs-log/pr-preview/pr-N/` (`preview.yml`). `BASE_PATH` sets the Vite base.
- **Back end:** Supabase, the same project as Wanderlog (`ricgwlityhtfxplcqoai`). The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from GitHub Secrets at build time. Sign-in is by email link (`signInWithOtp`).
- **Database changes:** only as numbered files in `supabase/migrations/`, checked by `scripts/check-migrations.mjs`. They are applied by the "Database migrations" workflow, which needs Hanh's approval (the `production-db` environment) and takes a backup first. Nightly encrypted backups (`db-backup.yml`). Read-only `db-inspect.yml`. `db-schema-snapshot.yml` refreshes `supabase/baseline/live_public_schema.sql` for tests.
- **Tests on every pull request** (`ci.yml`):
  - `checks` (build and migration rules);
  - `security-tests`: two-person database tests on local Postgres 17 with a Supabase shim, in `tests/db`;
  - `browser-tests`: Playwright at phone 390×844, laptop 1440×900 and laptop-150%-zoom 960×600, in `tests/browser`.
- **Splash:**
  - `src/pages/Home.tsx`, `Home.module.css` and `src/lib/flightPath.ts`.
  - Images in `public/images/`: `hero.webp` (Hanh's new hero, no plane painted in), `paper-plane.webp` and `jet.webp` (the flying planes; `jet.webp` is also the landed jet) and two card images.

## Locked Configuration (E-number registry)
| E# | Decision | Detail |
|----|----------|--------|
| E1 | Name and sections | Umbrella app "Hanh's Log" housing Wanderlog and Savorlog; other sections later |
| E2 | Stack kept | React, Supabase and Google Maps stay, as in Wanderlog |
| E3 | Address | hellohanh.github.io/hanhs-log (new repo `hellohanh/hanhs-log`) |
| E4 | Look | MICHELIN-Guide style: muted white ground, serif display (Newsreader) over sans (Public Sans), one deep-red accent. Light tokens #F6F4F0 / #FFFFFF / #1B1A18 / #5E5A54 / #E2DDD5 / accent #9E2A2B; dark #141312 / #1E1C1A / #F2EFEA / #ADA79E / #34302C / accent #E0716A |
| E5 | Dark mode | Follows the device setting; the header switch overrides it and is remembered (`hanhs-log-theme`) |
| E6 | Hero art | Hanh's watercolor illustration (phở, bánh mì, passport, stamps, dashed route, plane); stock photos only as placeholders |
| E7 | Splash shows on every visit | — |
| E8 | City search | Opens one results page, `/search?city=…`, with "Your trips in X" and "Your eateries in X" |
| E9 | Savorlog levels | Country → main dish; the dish is picked from a per-country list and new ones get added |
| E10 | Eatery info | Want-to-try / been, rating, price, photos; each person has their own rating and status |
| E11 | Savorlog sharing | Family can add via a separate Savorlog invite; co-travelers see all eateries in the trip's cities |
| E12 | "In city" | City name plus 20 km radius |
| E13 | Launch data | Existing Wanderlog dining pins are copied into Savorlog at launch |
| E14 | Working agreement | Every change goes on a branch and through a pull request with a preview link, never straight to main; `npm run build` passes before every push; all checks green before asking Hanh to merge; visual changes need an approved mockup first; secrets live only in GitHub Secrets |
| E15 | Flight path | 66 points Hanh mapped (`ROUTE` in `flightPath.ts`, 1536×1024 image pixels), Catmull-Rom smoothed and distance-indexed, heading from ±14px look-ahead; flying plane scale 0.42 |
| E16 | Flight is scroll-driven | Hero pinned under the header, flown by scrolling through a 240vh `.flightSpace` (scroll up flies back), eased 0.18 per frame; "Scroll to fly" hint until scrolling starts; reduced-motion shows the finished picture with nothing pinned |
| E17 | Fade timing (as a share of the scroll) | Flight ends 80%; painted plane fades in 76→84%; flying plane fades out 78→89%; landed at 94% → the search panel, the Where to? heading, both cards and the dark section background fade in together (600ms) |
| E18 | Desktop hero layout | A 1080 × 800 container on a full-width paper band (#FAF6E5); picture 1080 × 720 at 40px from the top; search panel 20px from the left with its bottom at 780px; the whole container scales down together (`--s`) when the window is narrower than 1080 or shorter than 800 + header |
| E19 | Pinned area | The pinned block is the hero container plus the Where to? section (not a full-window stage), so tall windows show the section right under the picture; that section's background is paper until landing, then the page colour |
| E20 | Phones | Splash phone layout parked until desktop is final: currently full-width picture, 40px above it, panel 20px below |
| E21 | Sign-in settings | The address is tidied before use (trimmed, https:// added, path removed); if the client can't be created, only sign-in turns off (never a blank page); errors name the address tried |
| E22 | Milestones | M1 Foundation ✅ · M2 Splash ✅ (desktop) · M3 Wanderlog trips + map · M4 Savorlog · M5 Savorlog on trips · M7 Switch over. M6 (the Wanderlog itinerary) is a planned milestone between M5 and M7 |

## Open Questions (Q-number registry)
| Q# | Question | Status |
|----|----------|--------|
| Q1 | Splash phone layout: should the panel overlap the picture or sit below it? | Parked (E20); finalise after desktop |
| Q2 | Milestone 3 checklist and order | Next session: lay it out for approval before code |

## Non-Negotiables
1. Never push to `main`. Branch, pull request, preview link, green checks, then Hanh merges.
2. Never hand over SQL to paste into Supabase. Database changes go only through numbered migrations and the approval-gated workflow. The database is shared with live Wanderlog.
3. A migration that adds a table or changes access comes with a `tests/db` test (a stranger can't see it; an invited member can). A new screen gets a line in `tests/browser/smoke.spec.ts`.
4. Never put keys in code or chat. The service-role key never goes near the website.
5. Visual changes need Hanh's approval of a mockup or preview first.
6. Ask decisions as tappable multiple-choice questions, never buried in prose (collaborative-build-method). Don't infer; ask.
7. Every PR description says what changed and what to check on the preview link.

## Stop Protocol
1. List every change this session and wait for Hanh to confirm.
2. Update SKILL.md (this file), README.md and SESSION_LEDGER.md, and land them through a pull request.
3. Verify a clean `npm run build` and green checks.
4. Produce a numbered zip, `SXXX MON D YYYY Hanhs Log.zip` (S001 = this first session). Present it with a table of every file: Name, Brief Description, Updated This Session.

## Lessons Learned
| L# | Lesson |
|----|--------|
| L1 | The design canvas can't play scroll-driven animation (its boards don't scroll), and a "press play" there showed nothing. Use time-based playback in mockups, or review scroll effects on the PR preview link. |
| L2 | Tracing a route by eye goes wrong (the first trace cut across the middle where there were no dashes). Give Hanh an inline editor (draggable dots over the picture, Play, send-back button) and let Hanh map it. |
| L3 | Inline widgets must embed images as small base64 (about 500px wide, low quality). Keep image bytes lean; a 40KB image is about 55K characters of output. |
| L4 | A Supabase address secret without `https://` makes `createClient` throw "Invalid supabaseUrl" at start-up, which blanks the whole page. Tidy the address and wrap the client in try/catch (E21). |
| L5 | "Failed to fetch" on sign-in means the address points somewhere other than the project (for example the dashboard page). The bare form is `https://<ref>.supabase.co`. A changed secret only takes effect after a rebuild (re-run the preview workflow). |
| L6 | Scroll progress on a sticky block must use (stickyTop − sectionTop) / (sectionHeight − stickyHeight). Using `innerHeight` left phones (with a two-row header) short of the landing point. |
| L7 | The header wraps to two rows on phones. Publish its real height as `--site-header-h` so pinned content sits right under it. |
| L8 | Browser tests need a `BASE_PATH=/` build. `npm run build` alone builds for `/hanhs-log/`, the preview server then shows nothing, and every test fails on missing buttons. |
| L9 | Don't run `pkill -f playwright` from a shell whose own command line contains "playwright": it kills itself (exit 144). |
| L10 | Stacked pull requests: merge in order (#4 before #5), using "Create a merge commit". Squash or rebase would make the stacked PR clash. |
| L11 | The CI security tests install Postgres 17 from the PGDG apt repo; a Docker Hub pull failed. Locally Postgres 16 needs `transaction_timeout` and MAINTAIN stripped from the PG17 dump. |
| L12 | A test DB per test file (from a template) keeps results that a rolled-back transaction would lose. Use session-level `set role` and `set_config`, not `set local`. |
| L13 | Pin-image cut-outs: GrabCut finds the white fuselage that colour masks miss. Fill erased areas with a flat paper tone from the image's top band plus grain, not sampled neighbours (they smudge leaves and stamps). |
