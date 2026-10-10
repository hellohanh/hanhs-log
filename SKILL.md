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
- **Fonts (E23):** Newsreader + Public Sans (Google Fonts) for the splash and header; Segoe UI self-hosted (`src/styles/fonts.css`, woff2 in `src/assets/fonts/`) inside Wanderlog and Savorlog pages via the `.segoe` class.
- **Hosting:** GitHub Pages at https://hellohanh.github.io/hanhs-log/. Deployed from the `gh-pages` branch by `deploy.yml` on every merge to `main`. Each pull request gets a preview at `/hanhs-log/pr-preview/pr-N/` (`preview.yml`). `BASE_PATH` sets the Vite base.
- **Back end:** Supabase, the same project as Wanderlog (`ricgwlityhtfxplcqoai`). The app reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAP_ID` from GitHub Secrets at build time; each build's run summary lists which are set (names only). Sign-in is by email link (`signInWithOtp`); guests joining by invite link sign in anonymously (`signInAnonymously`).
- **Wanderlog (M3):** `src/pages/Wanderlog.tsx` routes `/wander` (TripList), `/wander/trip/:id` (TripPage, ShareDialog, NamePrompt) and `/wander/join/:token` (JoinTrip). Data calls in `src/lib/trips.ts`.
- **Migration 0001 (`0001_trip_people.sql`, applied):** `profiles` (first names), `trip_members.joined_at`, `trip_people()`, `trip_people_counts()`, `remove_trip_member()`, `reset_trip_invite()`, and a trigger that stops members changing a trip's owner or invite link.
- **Pin standard:** `docs/pin-standard.md` (every category, colour and icon); custom icons in `src/assets/pin-icons/` (43 SVGs).
- **Database changes:** only as numbered files in `supabase/migrations/`, checked by `scripts/check-migrations.mjs`. They are applied by the "Database migrations" workflow, which needs Hanh's approval (the `production-db` environment) and takes a backup first. Nightly encrypted backups (`db-backup.yml`). Read-only `db-inspect.yml`. `db-schema-snapshot.yml` refreshes `supabase/baseline/live_public_schema.sql` for tests.
- **Tests on every pull request** (`ci.yml`):
  - `checks` (build and migration rules);
  - `security-tests`: two-person database tests on local Postgres 17 with a Supabase shim, in `tests/db`;
  - `browser-tests`: Playwright at phone 390×844, laptop 1440×900, laptop-150%-zoom 960×600 and monitor 2560×1440, in `tests/browser`. Signed-in screens are tested against a stand-in Supabase (`tests/browser/fake-supabase.ts`, test build points at `https://test-project.supabase.co`).
- **Splash:**
  - `src/pages/Home.tsx`, `Home.module.css` and `src/lib/flightPath.ts`.
  - Images in `public/images/`: `hero-noplane.webp`, `hero-plane.webp` (the painted plane cut out), `plane.webp` (the flying plane) and two card images.

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
| E13 | Launch data | ~~Existing Wanderlog dining pins are copied into Savorlog at launch~~ Replaced by E33 |
| E14 | Working agreement | Every change goes on a branch and through a pull request with a preview link, never straight to main; `npm run build` passes before every push; all checks green before asking Hanh to merge; visual changes need an approved mockup first; secrets live only in GitHub Secrets |
| E15 | Flight path | 66 points Hanh mapped (`ROUTE` in `flightPath.ts`, 1536×1024 image pixels), Catmull-Rom smoothed and distance-indexed, heading from ±14px look-ahead; flying plane scale 0.42 |
| E16 | Flight is scroll-driven | Hero pinned under the header, flown by scrolling through a 240vh `.flightSpace` (scroll up flies back), eased 0.18 per frame; "Scroll to fly" hint until scrolling starts; reduced-motion shows the finished picture with nothing pinned |
| E17 | Fade timing (as a share of the scroll) | Flight ends 80%; painted plane fades in 76→84%; flying plane fades out 78→89%; landed at 94% → the search panel, the Where to? heading, both cards and the dark section background fade in together (600ms) |
| E18 | Desktop hero layout | A 1080 × 800 container on a full-width paper band (#FAF6E5); picture 1080 × 720 at 40px from the top; search panel 20px from the left with its bottom at 780px; the whole container scales down together (`--s`) when the window is narrower than 1080 or shorter than 800 + header |
| E19 | Pinned area | The pinned block is the hero container plus the Where to? section (not a full-window stage), so tall windows show the section right under the picture; that section's background is paper until landing, then the page colour |
| E20 | Phones | Splash phone layout parked until desktop is final: currently full-width picture, 40px above it, panel 20px below |
| E21 | Sign-in settings | The address is tidied before use (trimmed, https:// added, path removed); if the client can't be created, only sign-in turns off (never a blank page); errors name the address tried |
| E22 | Milestones | M1 Foundation ✅ · M2 Splash ✅ (desktop) · M3 Wanderlog trips + map (in progress) · M4 Savorlog · M5 Savorlog on trips · M7 Switch over. M6 (the Wanderlog itinerary) is a planned milestone between M5 and M7 |
| E23 | Fonts | Segoe UI (Hanh's files, self-hosted, subset to Latin + Vietnamese, woff2) for Wanderlog and Savorlog page content only; splash and header keep Newsreader + Public Sans. Hosting the Windows fonts is Hanh's choice; Selawik is the fallback swap if ever needed |
| E24 | Desktop first | Design for a 2560 × 1440 monitor first; phone layouts later. Layouts widen to fill the monitor (trip cards three per row) |
| E25 | M3 plan | 0a Maps keys in Secrets ✅ · 0b live DB check ✅ · 0c mockups ✅ · 1 trip list ✅ · 2 trip page + sharing + people ✅ · 3 map · 4 add/edit pins · 5 pinned list. Copy trip, back up all and restore move after M6. HCMC districts overlay only on trips that include Ho Chi Minh City (20 km) |
| E26 | People on a trip | First names typed by each person (asked once; "Later" allowed); nobody sees emails. Owner-only Remove and Reset link. Nobody can change a trip's owner from the app; only the owner can change the invite link |
| E27 | Trip page | As the approved mockup: back link, name, destination · dates, Map tab (Itinerary greyed "coming in M6"), people avatars, Edit trip, Share & people; map area below |
| E28 | Pin shape | All pins are the teardrop (33 px). MICHELIN places: 36 px, deep red #9E2A2B, our own six-petal outline flower (1 px line), 1–3 stars in a chip above. Add-pin form gets MICHELIN / 1 / 2 / 3-star click boxes and the year. Full spec: docs/pin-standard.md |
| E29 | Pin icons | Google Material Symbols (names verified) plus Hanh's own drawings traced to SVG (43, `src/assets/pin-icons/`) |
| E30 | Pinned list | Tree of category › sub-category › sub-sub-category in both map views; every level collapsed by default, arrow expands |
| E31 | Non-food categories | Accommodation (6, blues) · Airport (alone) · Attraction (Berry: 5 groups, 15 types) · Shopping (8, greens) · Transport (7, teals). Colours and icons in docs/pin-standard.md |
| E32 | Nom-Nom | Top-level food category, coral #D85A30, icon `restaurant`. Levels: cuisine (the food's country) › main dish. Café, Bakery, Bar, Fusion beside the cuisines (can also carry a cuisine tag). Pin colour by region (9 warm colours). Dish icons per family, animals where the protein is the point. Vietnamese 28 dishes; SE Asian top 5 ×7 |
| E33 | Old food pins | Wanderlog's dining/cafe/bakery pins are not copied automatically; they get sorted into Nom-Nom city by city with Hanh (replaces E13) |
| E34 | Street food / fine dining | Badges on eatery pins (like MICHELIN), not dishes |

## Open Questions (Q-number registry)
| Q# | Question | Status |
|----|----------|--------|
| Q1 | Splash phone layout: should the panel overlap the picture or sit below it? | Parked (E20); finalise after desktop |
| Q2 | Milestone 3 checklist and order | Resolved → E25 |
| Q3 | "Tried it" and each person's rating on eatery pins (E10): how does it show on the pin and in the form? | Open |
| Q4 | Bib Gourmand: its own add-pin click box and pin chip? | Open |
| Q5 | Dishes for East Asian, South Asian, European, Americas cuisines, and Café / Bakery / Bar / Fusion | Open (top 5 each, like SE Asian) |
| Q6 | Names of five American icons: chicken bucket, curly fries, mac & cheese, chili bowl, side bowl | Open |
| Q7 | No lobster icon in Hanh's sets | Open |

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
| L14 | L9 again: `pkill -f "vite preview"` or `pgrep -f "vite.*4173"` matches its own shell and kills it (exit 144). Find the process ID first and kill it in a separate command. |
| L15 | A shallow clone only tracks main. Before `git branch -u`, add the branch to `remote.origin.fetch` and fetch, or the session's push check reports "no remote branch" even though the push worked. |
| L16 | Check every Google icon name against the official codepoints file (google/material-design-icons, MaterialSymbolsOutlined codepoints) before offering it; some obvious names don't exist (food_truck, a plain fish, bridge). |
| L17 | Inline pickers: the chosen option needs an unmistakable mark (thick outline, ✓, "chosen"), clicking it again must not un-choose it, and a live summary helps. A faint highlight produced "none" answers. |
| L18 | Tracing Hanh's PNG icons: split by connected shapes and drop the frame; where a drawing touches its frame, fill the frame, shrink it about 16 px and keep only ink inside. Trace with potrace at 96–240 px and round coordinates to keep each SVG small. |
| L19 | GitHub Secrets, job logs and Actions run summaries can't be read from a Claude session; ask Hanh to read the run summary (e.g. "Build settings"). Workflow dispatch and run status do work. |

