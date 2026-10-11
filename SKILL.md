# SKILL.md — Hanh's Log

Source of truth for Hanh's Log. **E-numbers** are locked decisions, **Q-numbers** are open
questions, **L-numbers** are lessons. Wanderlog's own SKILL.md (hanhs-wanderlog repo, E1–E106,
L1–L37+) is the reference for older pitfalls. Check it before re-solving a known problem.

## Project Overview
Hanh's Log is one web app that holds **Wanderlog** (trips: maps, pins, day-by-day itineraries,
shared with co-travelers) and **Savorlog** (eateries, organised by country, then main dish).
Savorlog pins appear automatically on any Wanderlog trip **by city** (a Rome trip shows only
Rome eateries). Later sections may be added. It is rebuilt from the ground up with a modern,
MICHELIN-Guide-style look, using today's Wanderlog features as the checklist. Since session 4
it has **its own Supabase project and starts from a clean slate**; live Wanderlog (site and
database) is never touched, so the two can be compared during the build (E39, E40).

## Architecture
- **Front end:** React 18 + Vite 5 + TypeScript (strict), react-router-dom v6, CSS Modules plus design tokens (`src/styles/tokens.css`), and vite-plugin-pwa ("add to home screen").
- **Fonts (E23):** Newsreader + Public Sans (Google Fonts) for the splash and header; Segoe UI self-hosted (`src/styles/fonts.css`, woff2 in `src/assets/fonts/`) inside Wanderlog and Savorlog pages via the `.segoe` class.
- **Hosting:** GitHub Pages at https://hellohanh.github.io/hanhs-log/. Deployed from the `gh-pages` branch by `deploy.yml` on every merge to `main`. Each pull request gets a preview at `/hanhs-log/pr-preview/pr-N/` (`preview.yml`). `BASE_PATH` sets the Vite base.
- **Back end:** Supabase, Hanh's Log's own project (`rvrwljqzbsrstcyklegy`, East US, since session 4; E39). Wanderlog's project (`ricgwlityhtfxplcqoai`) is never touched. The app reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY` and `VITE_GOOGLE_MAP_ID` from GitHub Secrets at build time; each build's run summary lists which are set (names only). Sign-in is by email link (`signInWithOtp`); guests joining by invite link sign in anonymously (`signInAnonymously`).
- **Wanderlog (M3):** `src/pages/Wanderlog.tsx` routes `/wander` (TripList with the New trip popup), `/wander/trip/:id` (TripPage, TripForm for Edit trip, ShareDialog, NamePrompt, TripMap) and `/wander/join/:token` (JoinTrip). Data calls in `src/lib/trips.ts`; trip place helpers in `src/lib/place.ts`; city lookup (Google Places API (New) Text Search) and saved map place in `src/lib/city.ts`.
- **Trip map (`TripMap.tsx`):** Google Maps JS loaded by `src/lib/googleMaps.ts`; looks, defaults, Pins logic in `src/lib/mapStyles.ts`; our camera control in `CameraControl.tsx`; HCMC districts from `public/hcm-districts.geojson` (Wanderlog's file) with in-view boxes in `src/lib/districts.ts`. Google's own looks use the tilt-capable vector map with the `VITE_GOOGLE_MAP_ID` secret; hand-made looks and No pins use the flat (raster) map (E43–E46).
- **Migration 0001 (`0001_hanhs_log_foundation.sql`, applied to the new project):** `profiles`, `trips` (name, country, city_primary/secondary/tertiary, dates, owner, invite link, `map_*` saved place), `trip_members` (with `joined_at`), `is_on_trip()`, row-level security, `join_trip_via_invite()`, `trip_people()`, `trip_people_counts()`, `remove_trip_member()`, `reset_trip_invite()`, and the owner/invite guard. Starts with a safety stop that refuses Wanderlog's database. The Wanderlog-era migrations (old 0001–0003) are archived unchanged in `supabase/archive/wanderlog-db/`.
- **Pin standard:** `docs/pin-standard.md` (every category, colour and icon); custom icons in `src/assets/pin-icons/` (43 SVGs).
- **Database changes:** only as numbered files in `supabase/migrations/`, checked by `scripts/check-migrations.mjs`. They are applied by the "Database migrations" workflow, which needs Hanh's approval (the `production-db` environment) and takes a backup first. Nightly encrypted backups (`db-backup.yml`). Read-only `db-inspect.yml`. Backups skip cleanly while the database has no tables. The test baseline `supabase/baseline/live_public_schema.sql` is empty since session 4 (migrations build everything); don't run `db-schema-snapshot.yml` unless the database was changed outside this repo. Every preview build runs a read-only **connection check** (notes on the run: website project, anon key and sign-in settings, database secret's project, connected database).
- **Tests on every pull request** (`ci.yml`):
  - `checks` (build and migration rules);
  - `security-tests`: two-person database tests on local Postgres 17 with a Supabase shim, in `tests/db`;
  - `browser-tests`: Playwright at phone 390×844, laptop 1440×900, laptop-150%-zoom 960×600 and monitor 2560×1440, in `tests/browser`. Signed-in screens are tested against a stand-in Supabase (`tests/browser/fake-supabase.ts`, test build points at `https://test-project.supabase.co`).
- **Splash:**
  - `src/pages/Home.tsx`, `Home.module.css` and `src/lib/flightPath.ts`.
  - Images in `public/images/`: `hero.webp` (Hanh's new hero, no plane painted in), `paper-plane-v2.webp` (E48) and `jet.webp` (the flying planes; `jet.webp` is also the landed jet) and two card images.

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
| E15 | Flight path | ~~66 points, flying plane scale 0.42~~ Replaced by E35. 86 points Hanh mapped in the flight-path editor (`ROUTE` in `flightPath.ts`, 1536×1024 image pixels, ends at the landed jet 935, 233), Catmull-Rom smoothed and distance-indexed, heading from ±14px look-ahead |
| E16 | Flight is scroll-driven | Hero pinned under the header, flown by scrolling through a 240vh `.flightSpace` (scroll up flies back), eased 0.18 per frame; "Scroll to fly" hint until scrolling starts; reduced-motion shows the finished picture with nothing pinned |
| E17 | Fade timing (as a share of the scroll) | Flight ends 80%; landed jet fades in 76→84%; flying jet fades out 78→89%; landed at 94% → the search panel, the Where to? heading, both cards and the dark section background fade in together (600ms) |
| E18 | Desktop hero layout | A 1080 × 800 container on a full-width paper band (~~#FAF6E5~~ #F6EFE2, E38); picture 1080 × 720 at 40px from the top; search panel 20px from the left with its bottom at 780px; the whole container scales down together (`--s`) when the window is narrower than 1080 or shorter than 800 + header |
| E19 | Pinned area | The pinned block is the hero container plus the Where to? section (not a full-window stage), so tall windows show the section right under the picture; that section's background is paper until landing, then the page colour |
| E20 | Phones | Splash phone layout parked until desktop is final: currently full-width picture, 40px above it, panel 20px below |
| E21 | Sign-in settings | The address is tidied before use (trimmed, https:// added, path removed); if the client can't be created, only sign-in turns off (never a blank page); errors name the address tried |
| E22 | Milestones | M1 Foundation ✅ · M2 Splash ✅ (desktop) · M3 Wanderlog trips + map (in progress; steps 1–3 ✅) · M4 Savorlog · M5 Savorlog on trips · M7 Switch over. M6 (the Wanderlog itinerary) is a planned milestone between M5 and M7 |
| E23 | Fonts | Segoe UI (Hanh's files, self-hosted, subset to Latin + Vietnamese, woff2) for Wanderlog and Savorlog page content only; splash and header keep Newsreader + Public Sans. Hosting the Windows fonts is Hanh's choice; Selawik is the fallback swap if ever needed |
| E24 | Desktop first | Design for a 2560 × 1440 monitor first; phone layouts later. Layouts widen to fill the monitor (trip cards three per row) |
| E25 | M3 plan | 0a Maps keys in Secrets ✅ · 0b live DB check ✅ · 0c mockups ✅ · 1 trip list ✅ · 2 trip page + sharing + people ✅ · 3 map ✅ (session 4) · 4 add/edit pins · 4b sort old pins from Hanh's Wanderlog export, one by one with Hanh (session 4) · 5 pinned list. Copy trip, back up all and restore move after M6. ~~HCMC districts only on trips within 20 km~~ Replaced by E46 |
| E26 | People on a trip | First names typed by each person (asked once; "Later" allowed); nobody sees emails. Owner-only Remove and Reset link. Nobody can change a trip's owner from the app; only the owner can change the invite link |
| E27 | Trip page | As the approved mockup: back link, name, ~~destination~~ cities · Country (E41) · dates, ~~Map tab (Itinerary greyed "coming in M6")~~ no tabs (E49), people avatars, Edit trip, Share & people; map area below |
| E28 | Pin shape | All pins are the teardrop (33 px). MICHELIN places: 36 px, deep red #9E2A2B, our own six-petal outline flower (1 px line), 1–3 stars in a chip above. Add-pin form gets MICHELIN / 1 / 2 / 3-star click boxes and the year. Full spec: docs/pin-standard.md |
| E29 | Pin icons | Google Material Symbols (names verified) plus Hanh's own drawings traced to SVG (43, `src/assets/pin-icons/`) |
| E30 | Pinned list | Tree of category › sub-category › sub-sub-category in both map views; every level collapsed by default, arrow expands |
| E31 | Non-food categories | Accommodation (6, blues) · Airport (alone) · Attraction (Berry: 5 groups, 15 types) · Shopping (8, greens) · Transport (7, teals). Colours and icons in docs/pin-standard.md |
| E32 | Nom-Nom | Top-level food category, coral #D85A30, icon `restaurant`. Levels: cuisine (the food's country) › main dish. Café, Bakery, Bar, Fusion beside the cuisines (can also carry a cuisine tag). Pin colour by region (9 warm colours). Dish icons per family, animals where the protein is the point. Vietnamese 28 dishes; SE Asian top 5 ×7 |
| E33 | Old pins | ~~Wanderlog's dining/cafe/bakery pins … sorted into Nom-Nom city by city~~ Widened by E40: no old pins (any category) appear until sorted; Hanh provides the Wanderlog export and they're added one by one in step 4b (replaces E13) |
| E34 | Street food / fine dining | Badges on eatery pins (like MICHELIN), not dishes |
| E35 | Paper plane (session 3) | The flight takes off as the red paper plane (`paper-plane.webp`, now `paper-plane-v2.webp` (E48), 150 wide, nose −46°) and turns into the jet (`jet.webp`, 400 wide, nose −16°) at 0.68 with the landing's fade values: jet in 0.68→0.76, paper out 0.70→0.81. Sizes in hero pixels |
| E36 | New hero (session 3) | `hero.webp` is Hanh's new picture (Amalfi, phở, Eiffel Tower, bánh mì, Vietnam map, Japan postcard) with no plane painted in; old `hero-noplane`, `hero-plane` and `plane` images removed |
| E37 | Landed jet (session 3) | The jet lands as itself (`jet.webp`) at 935, 233, 400 wide, tilted 4.75° (`LANDED_JET`), fading in per E17 |
| E38 | Hero edge (session 3) | Page paper is #F6EFE2, sampled from the new hero's edge; the picture's outer 40px fades into it (SVG mask, blur 20) so there's no visible edge |
| E39 | Own database (session 4) | Hanh's Log has its own Supabase project (`rvrwljqzbsrstcyklegy`); live Wanderlog's site and database are never touched (Hanh compares old vs new during the build). Migration 0003 (archived) gave Wanderlog's database back exactly as before Hanh's Log. Secrets `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL` point at the new project; the first migration refuses Wanderlog's database. Replaces "shares the live Wanderlog database" |
| E40 | Clean slate (session 4) | Trips are built from scratch in Hanh's Log; old Wanderlog trips and pins stay in Wanderlog. Old pins come later from Hanh's export, sorted in one by one (step 4b) |
| E41 | Trip form (session 4) | New trip opens as a popup (Cancel, Escape or click outside closes it); Edit trip uses the same form. Fields: Trip name; Country (type with suggestions, every country); Primary City (the map opens here), Secondary City, Tertiary City; Start, End. Country and Primary required, dates optional. Before saving it shows "✓ Map opens on: …" (Primary City in that Country via Google Places) and saves that match on the trip. Cards and the trip page show "Primary, Secondary, Tertiary · Country". Empty list: "No trips yet. Your trips from the old Wanderlog stay there; start fresh here with New trip." |
| E42 | Opening view (session 4) | The map opens on the Primary City's centre at **zoom 13**. Google's city outline isn't used (HCMC's covers half of southern Vietnam since the 2025 merger; Paris's is tiny) |
| E43 | Map looks (session 4) | 11 looks in a Map look panel (tiles, closes on pick, ×, Escape or click outside): Google standard, Google dark, Paper, Paper dark, Silver, Retro, Dark, Night, Aubergine, Terrain, Satellite (photos with names; "Satellite + labels" merged in). Defaults: light = Google standard, dark = Google dark. Each mode remembers its own pick on this device; "Use the default" resets it |
| E44 | Camera control (session 4) | Our own control replaces Google's (bottom-right), a 3 × 4 grid: [tilt up, up, zoom in] [left, reset, right] [tilt down, down, zoom out] [rotate left, rotate right, open/close]. Starts closed (only the open/close button shows). Tilt 10° per press, rotate 15°. Reset (red, centre) = Primary City centre, zoom 13, flat, north up. Google's own looks run on the tilt-capable vector map (our Map ID); hand-made looks need the flat map, where tilt and rotate are greyed out with the tip "Tilt and rotate work on Google looks". Switching kinds keeps the view |
| E45 | Pins / No pins (session 4) | The top-left map buttons are round icons only, with labels in tooltips: [Map look] [Pins] [Districts]. Pins hides Google's place pins (shops, restaurants, hospitals, schools, landmarks); transit pins (bus, train, metro, airports), street/area names, roads and parks stay. Remembered on this device. Greyed out on Google dark (can't be hidden without a Google Cloud style). Hiding pins needs the flat map, so tilt is greyed while pins are hidden |
| E46 | HCMC districts (session 4) | The old Wanderlog overlay: each of the 22 districts filled in its own colour (golden-angle hues, `hsl(h,65%,55%)` at 20%) with a solid `hsl(h,65%,40%)` 1.5 px outline; names in #7A0C2E pills, white UPPERCASE 11 px bold. The Districts chip shows on any trip only while at least one district is in view, and disappears once none are |
| E47 | Trip card counts (session 4) | Cards count sorted pins only (every Hanh's Log pin is sorted: its category is picked when added) |
| E48 | Paper plane v2 (session 4) | Hanh's updated plane with no shadow under the tail, same 275 × 223 and angle; saved under a new name, `paper-plane-v2.webp`, so no cached copy shows the old one |
| E49 | Itinerary panel (session 4) | The itinerary moves from its own tab into a right panel over the map (Map/Itinerary tabs removed). Closed by default behind an "Itinerary" tab on the map's right edge; 320 px (same as Places) or 640 px wide (covers the map); open/closed and width remembered on this device. Header: day route map, widen, close. Day tabs (one per trip date, made automatically, plus "+ Day" extra days; no stored day numbers). Row: Show all pins, Add travel, Day note (new, one per day). Hour timeline (60 px/h, from 6:00) with travel legs as in old Wanderlog. No pool: places are dragged from the Places panel, more than once a day is fine. Coming with pins: connectors between stops (empty circle → pick Walk / Drive-taxi-Grab / Transit / Bike-motorbike with Google times; shows icon + time), the day's route drawn on the map, other pins dimmed |
| E50 | Itinerary blocks (session 4) | Day tabs wrap onto rows (free-flowing, no sideways scroll). Clicking an empty spot on the timeline opens "Add at …" at the 15-minute mark under the click, 30 min long: Activity (free-text block, migration 0003), Travel (opens the travel form with those times), Place (greyed until pins). The popup opens below or above the click, or docks over the day tabs on a short window. Activities have top and bottom handles (5-min steps) and drag to move; a click opens edit/delete. Travel legs stay fixed (edited in their form). The timeline keeps at least 360 px; the panel scrolls as a whole on short windows |
| E51 | WTG / VIS (Q3, session 4) | Every pin has each person's status: WTG (want to go) or VIS (visited). VIS needs a verdict: ✓ revisit, – deserves a 2nd chance, ✗ don't go back; plus an optional 1–5 rating in half stars. The badge at the pin's top-right: blank orange `#E8862A` for WTG; green `#2F8A3E` with a white ✓, yellow `#F2C230` with a black dash, red `#C8352F` with a white ✗. Anyone's status shows; the most recent VIS verdict wins, otherwise WTG. The average rating shows in the card only. Status can be set in the add form; WTG is the default. Applies to all pins |
| E52 | MICHELIN on pins (Q4, session 4) | No Bib Gourmand box or chip: Bib places are "Mentioned". The add card offers None / Mentioned / ★ / ★★ / ★★★ (food and drink only) plus the year. A MICHELIN place is the red teardrop with our flower and its WTG / VIS badge; starred places add the stars chip above. One MICHELIN filter chip covers mentioned and starred |
| E53 | Adding pins (session 4) | Only from the Places panel's Google search box; the category is always picked by hand (category › sub › sub-sub). Places categories show only when they have pins |
| E54 | Pin toggles (session 4) | Places "Show all pins": on by default, off fades all the trip's pins on the map to 10% (the list never fades). Itinerary "OTD Pins" (comes with places on days): off by default; on shows the day's pins full strength and fades the rest to 10%, overriding Places; not applied when the itinerary is closed. Both reset every visit |
| E55 | Import order (session 4) | Old Wanderlog pins are imported after Savorlog (M4/M5) and before the switch-over (M7) |

## Open Questions (Q-number registry)
| Q# | Question | Status |
|----|----------|--------|
| Q1 | Splash phone layout: should the panel overlap the picture or sit below it? | Parked (E20); finalise after desktop |
| Q2 | Milestone 3 checklist and order | Resolved → E25 |
| Q3 | "Tried it" and each person's rating on eatery pins (E10): how does it show on the pin and in the form? | Resolved → E51 |
| Q4 | Bib Gourmand: its own add-pin click box and pin chip? | Resolved → E52 (no Bib box; Bib = Mentioned) |
| Q5 | Dishes for East Asian, South Asian, European, Americas cuisines, and Café / Bakery / Bar / Fusion | Open (top 5 each, like SE Asian) |
| Q6 | Names of five American icons: chicken bucket, curly fries, mac & cheese, chili bowl, side bowl | Open |
| Q7 | No lobster icon in Hanh's sets | Open |
| Q8 | Hiding Google dark's pins, or a no-label Google dark, needs a Google Cloud style on our Map ID | Parked (E45) |

## Non-Negotiables
1. Never push to `main`. Branch, pull request, preview link, green checks, then Hanh merges.
2. Never hand over SQL to paste into Supabase. Database changes go only through numbered migrations and the approval-gated workflow, against Hanh's Log's own project. Never touch live Wanderlog's site or database (E39).
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
| L20 | Hanh may merge a pull request while work continues. Check `merged` on the PR before pushing more commits to its branch; if it's merged, start a fresh branch from main and open a new PR (the edge fix became #16). |
| L21 | Changes can appear in the working folder that this session didn't make (another session). Read the diff and check it against Hanh's values before building on it (the landed-jet tilt arrived as 3.5° instead of 4.75°). |
| L22 | When the picture behind an inline editor changes, re-open the editor on the new picture with Hanh's last points loaded and any new controls added (landed jet size and tilt), rather than starting over. |
| L23 | `gh pr create` fails here (GraphQL is blocked); open pull requests with `gh api repos/{owner}/{repo}/pulls -f base=… -f head=… -F body=@file`. |
| L24 | Google's city outline (Places viewport) is the administrative boundary, not the city people mean: HCMC's covers half of southern Vietnam since the 2025 merger, Paris's is tiny. Open on the city centre at a fixed zoom (E42). |
| L25 | With a Map ID (needed for the tilt-capable vector map) Google ignores JSON `styles`; tilt and rotate need the vector map; Map ID, rendering type and `colorScheme` are fixed when a map is made, so switching between them means making a new map (keep the view). Prove Google behaviour on a preview-only test page first (#27). |
| L26 | Read every browser-test result, not just the summary line: a phone-size failure hid behind "3 passed" (#24). Filter output for ✘ and "failed". |
| L27 | L20 happened again (#29 merged mid-push). Check `merged` immediately before every push to a PR branch; if merged, cherry-pick onto a fresh branch from main (#30). |
| L28 | The site is an installable app that keeps images: replaced images need a new file name (`paper-plane-v2.webp`), or browsers keep showing the old one. |
| L29 | A brand-new database has no tables, so the pre-migration backup check failed; backups now skip cleanly when there are no tables. |
| L30 | `git stash -u` with moved files can fail to restore untracked files ("already exists"); prefer a WIP commit on the branch over stashing. |
| L31 | This session's shell can't reach github.io or supabase.co. To check secrets-based connections, have a workflow print facts (never values) as `::notice::` notes and read them via the check-runs annotations API. |
| L32 | Free-text destinations break city lookups ("Vietnam; Hồ Chí Minh City" found Vietnam). Structured fields (Country + Primary City) fixed it (E41). |
| L33 | Text written between tool calls isn't shown to Hanh verbatim. Anything Hanh must read mid-task (an explanation, a definition like "the pool") goes through SendUserMessage or into the question itself. |
| L34 | Check new panels on the laptop-at-150% size (960 × 600), not just the monitor: wrapped day tabs squeezed the timeline to 0 px there, and a popup the height of the visible timeline hid the clicked spot. Give scroll areas a minimum height and place popups by measuring the room on screen. |
