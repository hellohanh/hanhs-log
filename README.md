# Hanh's Log

One app for trip planning (**Wanderlog**), eateries (**Savorlog**) and other places
(**Roaminglog**), sharing one
login and one database (its own Supabase project; the old Wanderlog site and
database are separate and untouched). Live at https://hellohanh.github.io/hanhs-log/

## Current state (Session 15, OCT 20 2026)

| Milestone | Status |
|---|---|
| M1 Foundation: design tokens, light and dark mode, header, routes, email sign-in, add to home screen | ✅ live |
| M2 Splash: scroll-driven paper plane that turns into the jet and lands, search and section panels, city search page | ✅ live (computer and phones, E105) |
| M3 Wanderlog trips and map inside Hanh's Log | ✅ live (trips, sharing, the map, pins, places on itinerary days, connectors + day route, the pinned-list tree) |
| M4 Savorlog (Nom-Nom: cuisine → dish) | ✅ live (shared catalogue, location gate, add/edit + photos, family invite) |
| M5 Savorlog eateries on trips | ✅ live (every catalogue eatery shows on a trip's map and the Nom-Nom list follows the map, E101; food-adds route into the catalogue; any eatery schedulable on days; only "forbid new food pins" deferred) |
| Old Wanderlog pin import (after Savorlog, before switch-over) | ✅ built (`/wander/import`, E71); Hanh works through the 227 places |
| Roaminglog (non-eatery places: Spot List, on every trip) | ✅ live (E119–E121) |
| M6 Wanderlog itinerary polish | planned |
| M7 Switch over from the old Wanderlog | planned |

## What's built
- **Session 15:**
  - **Offline:** what you've opened is saved on the device and shows with no signal under a dark "Offline · showing what was saved" line (E122); changes made offline wait, marked "waiting to send", and send when the signal returns (E123); if someone else changed the same thing, a picker asks which one stays (E124, migration 0023).
  - **How-to page** at [hellohanh.github.io/hanhs-log/how-to](https://hellohanh.github.io/hanhs-log/how-to): a dark field guide with screenshots (E125).
  - **Your trips:** the trip actions sit in a ☰ beside + New trip (computer) or in the site ☰ (phone), which also links to How-to (E126).
- **Session 14:**
  - **Roaminglog** (`/roam`, Spot List): one shared catalogue of sights, stays, shops, airports and stations, shown on every trip's map; the old non-food trip pins were moved into it (migrations 0021–0022, E119–E121). Third splash card and header / ☰ links.
  - MICHELIN chips on two lines (None / Selected / Bib, then the stars) and a Bib smiling-face chip (E109); a **Vibe** box with 9 ticks (E110).
  - Google's spelling suggested under the name boxes; BBQ in capitals (E111). Double-click a list place to edit (E112). MICHELIN chip shows MICHELIN only; dish menu A–Z (E113). Type a new main dish (E114).
  - Copy pins between trips (E115), notes on itinerary blocks (E116), one invite link for several trips (E117).
- **Session 13:**
  - Everyone on a trip (link guests and past trips too) sees and can edit the whole Munch List catalogue; a trip's map shows every eatery and its Nom-Nom list follows the map (E101, migration 0015).
  - A **home_pin** map button glides to the day's city (computer; on phones under Day route); Reset goes there too (E102).
  - A "new version ready · Reload" notice after each deploy (E103).
  - Phones: sheets close to just a cherry-red (light) / mustard (dark) handle, swipe up to half and full; one-line bottom bar (E104). The splash shows its search panel from the start (E105). Munch List is a map with a top search handle (go to a place or add an eatery) and a bottom Catalogue handle (E107).
  - GPins is a pin-with-G icon everywhere (E106). Munch List has no startup popup (E108). The pin popup's note box is readable in dark mode.
- **Phones** (screens 760 px or narrower; monitor and laptop unchanged): a slim header with a ☰ menu; on a trip, one title bar, map buttons for Map look, My location and Day route, and **Places** / **Itinerary** as sheets that slide up from the bottom. The itinerary opens on today during the trip; tap a time block to edit its times; the back gesture steps back one layer. Day route fades the other pins as on the computer (E90, E91). Session 13: closed / half / full sheets with coloured handles (E104), the splash (E105) and Munch List (E107) on phones. Still to come: add/edit forms on phones (step 3).
- **Savorlog (Munch List)**: the list and pins follow the map; move to the next city and it fills in. The City/Country field glides the map to a place (E92, E95; no startup popup since E108). The cuisine menu in the add card is A–Z (E93).
- **Maps**: crowded pins merge into red numbered bubbles that split when tapped (E96); picking a place, clicking a list row or tapping a bubble glides the map (E97).
- **Pins and popup**: Hanh's own line-art icons for every non-food category in the pins and the popup (E98, E99). The popup is 350 px, with ✕ / ✎ / bin down the right and the English name over the local name in red italic (E100).
- **Nom-Nom** is an ordinary A–Z category in a trip's Places list (E89).
- **Splash (`/`)**:
  - Hanh's watercolor hero (Amalfi, phở, Eiffel Tower, bánh mì) in a 1080 × 800 container; its edge fades into the page's paper colour.
  - Scrolling flies Hanh's red paper plane (no shadow, `paper-plane-v2.webp`) along the route Hanh mapped; late in the flight it turns into the jet.
  - At the end the jet settles in the sky by the Eiffel Tower, and the search panel, Where to? section, and the Wanderlog, Savorlog and Roaminglog cards fade in.
  - With reduced motion, the page shows the finished picture straight away.
- **Wanderlog trip list (`/wander`)**: a clean slate in Hanh's Log's own database. Upcoming trips (soonest first) and past trips (faded), with cities · Country, dates, pin count (sorted pins only) and people, owned/shared labels; owner-only delete. **New trip** opens a popup: Trip name; Country (suggests as you type); Primary City (the map opens here), Secondary, Tertiary; dates optional; it shows "✓ Map opens on: …" before saving. Built for a 2560 × 1440 monitor first.
- **Trip page (`/wander/trip/<id>`)**: name, cities · Country and dates, people, Edit trip (same form), and Share & people (invite link, owner-only Reset link and Remove, first names).
- **Trip map**: opens on the Primary City's centre at zoom 13, with the trip's own pins drawn on it.
  - **Map look**: 11 looks. Defaults are Google standard (light) and Google dark (dark), remembered per mode on this device.
  - **Pins / No pins**: hides Google's shop, restaurant and landmark pins and keeps transit pins (this is separate from the trip's own pins).
  - **Districts**: the old Wanderlog's coloured HCMC overlay; the chip shows whenever a district is in view.
  - **Camera control**: our own 3 × 4 control with tilt (10°), rotate (15°) and a reset button. Tilt works on Google's own looks (and needs a Vector Map ID); it's greyed out on hand-made looks and while pins are hidden.
- **Places panel** (left of the map): a Google search box adds a place; the add/edit card sets the category by hand (category › sub › sub-sub), each person's **WTG / VIS** status (visited gets a verdict — revisit, 2nd chance, don't go back — and an optional half-star rating), **MICHELIN** (mentioned / 1–3 stars + year, food and drink only) and Street food / Fine dining. The list groups pins by category (a category shows only when it has pins). **Show all pins** and a **MICHELIN** chip fade the map's pins.
- **Pins on the map**: teardrops carrying the pin's icon, colour and a status badge (orange WTG, or green ✓ / yellow – / red ✗ for visited); MICHELIN places are the red flower pin with a stars chip.
- **Itinerary panel**: on the map's right edge (closed by default; 320 or 640 px, remembered): day tabs for the trip's dates plus extra days, day notes, travel legs (flight, train, bus, own transport), activity blocks, and **places scheduled onto the day** as time blocks. A scheduled place can be a **trip pin or a Savorlog eatery** (M5): add one by dragging a Places or Nom-Nom row onto a day tab or timeline slot, the Add popup's **Place** picker, a **+** on a list row, or (pins) the card's **Add to day**. **Day route** draws the day's route on the map across pins and eateries alike and fades the rest. Click a time to add; drag an item's edges or middle to change its time.
- **Savorlog (`/savor`)**: one shared eatery catalogue, filed cuisine-country → main dish, held by a single family **circle** and belonging to no trip. Opening it asks **where** first (closable) — a country (framed to its mainland) or a city (zoom 13); the map glides there, and the catalogue tree and the pins always show what's on the map (E95). A Google **search-to-add** opens the add/edit card: cuisine → dish, **price $–$$$$**, MICHELIN, Street food / Fine dining, your WTG/VIS + rating, a note, and up to **3 photos** (uploads → a Google place photo → a "Photo coming soon" placeholder). **Remove** sends an eatery to a pending-deletion queue the owner confirms. A **Family** button shares a signed-in-family-only invite (`/savor/join/<code>`) with owner-only reset/remove. The same eatery shows on any trip within 20 km of its cities (M5): a trip's Places panel lists them under **Nom-Nom** (an A–Z category), the map draws them, picking the Nom-Nom category while adding a place on a trip opens this same add panel (saving to the catalogue, not a trip pin), and an eatery can be scheduled onto an itinerary day like a pin.
- **Invite links (`/wander/join/<code>`)**: signed-in people join straight away; others tap Join trip (no email) and are asked for a first name.
- **City search (`/search?city=…`)**: one results page per city; trips and eateries fill in later.
- **Sign in (`/signin`)**: email link through Hanh's Log's own Supabase project.
- **Fonts**: Segoe UI inside Wanderlog and Savorlog; Newsreader and Public Sans on the splash and header.
- **Import old pins (`/wander/import`)**: a button on the trip list (Savorlog owner only) opens the import queue. Load Claude's prepared file once (made from the Wanderlog export; kept out of the repo). Pick a city, the trip its non-food places go into, then each category in order; every place opens the real add card already filled in (English : Local name, category or dish, MICHELIN, badges, old note, WTG) with **Save and next**, **Skip for good** and **‹ Back**. Progress is in the database, so it carries on from any device.
- **Place names**: every pin and eatery is `English : Local` (Japan: `明治神宮 (Meiji Jingū)`), typed in two boxes on the add cards (E72).
- **Travel legs**: Title first on the form; blocks read `AUSTIN (AUS) 06:00 CST (UTC−6) •••🛬••• LOS ANGELES (LAX) 07:46 PST (UTC−8)` (E73). A **copy icon** links a leg to another trip (long layovers): one leg shown on both, read only on the other trip, deleting removes it everywhere (E74).
- **Trip list**: ✎ on each card edits the trip without opening it (E75).
- **Maps**: the **GPins ON / GPins OFF** chip hides Google's place pins; on Google standard and Google dark a second, no-pins Map ID keeps tilt, rotate and 3D buildings with GPins OFF (E76). **Map look → Check all controls** tests every camera button on every look on your screen (E77).
- **Map pin popup**: clicking a pin, or a place in the left list, opens a popup on the pin: bold name, ✎ to edit, a bin (asks first), address, phone (tap to call), website, View in Google Maps and the note, editable in place; a click outside closes it (E85). Status badges now sit **inside** the pin, just above the point (E86). With the itinerary panel open, centring uses the visible part of the map, and the map shifts when the panel opens or closes (E87).
- **Places lists**: an **eye** on every row (trip Places and Savorlog) picks what shows when Show all is off, e.g. your hotel plus the bánh mì spots (E84). Labels are in Title Case and every level is A–Z (E88). The same Google place can be pinned only once per trip (E82).
- **Itinerary times**: 24-hour hour and minute menus everywhere (E81). A flight across the date line that lands "before" it left gets a **second tab for the same date** (e.g. Sun Jan 3 · Seoul, Sun Jan 3 · Seattle), with the flight split across both (E80). The day route's drive line is bright blue.
- **Savorlog**: the place popup can be closed; then the map starts on the world and the list follows what's on the map (E83).
- **Speed**: the splash's soft edge is baked into the picture (about 85% less drawing work while the plane flies), and replaced maps are cleaned up (E79). Packages are current with `npm audit` clean (E78).
- **Pin standard**: every category, colour and icon for Wanderlog and Savorlog pins is in [docs/pin-standard.md](docs/pin-standard.md); Hanh's own icons are in `src/assets/pin-icons/`. Every Nom-Nom cuisine has its dish list (top 5 each, Vietnamese 28; Fusion has none, E70).
- **Safety net**:
  - every pull request gets a preview link, a build check, migration rules, two-person security tests and browser tests at phone, laptop, 150% zoom and monitor sizes;
  - database changes run only through the approval-gated migrations workflow, after a backup;
  - backups run nightly, encrypted;
  - every preview build runs a read-only connection check (website project, sign-in settings, database);
  - publishes to the site never overlap: each waits for any running GitHub Pages job, then confirms GitHub published it and retries a hiccup by itself (L41);
  - all workflow actions run on Node 24 (L42).

## What's next
1. **Try offline on the phone**: open a trip, airplane mode, change a note, back online; check the picker with a second device (E122–E124).
2. **Check Roaminglog live**: the Spot List and a trip after a full refresh; in the import queue tap Bib on Bib places (E118).
3. **Map check results**: run Map look → Check all controls on the live site and grey out anything Google can't do on Terrain / Satellite.
4. **Work through the old-pin import** at `/wander/import` with `hanhs-log-import-2026-10-13.json` (E71); fix anything the queue shows up.
5. **Phone step 3**: add/edit forms on phones (new trip, add place, travel, the eatery card), mockup first at 412 × 891. Steps 4 (splash, E105) and 5 (Munch List, E107) are done.
6. **M5.2b** — a migration (`0024` or later) forbidding new food pins in the `pins` table going forward (existing ones left alone), landed with its test rework. The only deferred piece of M5.
7. **M6** itinerary polish, then **M7** switch-over.

Also open: **Q6** (American icon names: chicken bucket, curly fries, chili bowl, side bowl), **Q7** (no lobster icon). Q1 is resolved (E105), Q8 (E76). Tidy-up for Hanh: delete the 64 merged branches on GitHub (Branches page) and tick **Settings → General → Automatically delete head branches**.

**One-time setup is done** (sessions 8–9): migrations 0001–0023 are applied, and the public `eatery-photos` bucket exists with INSERT/DELETE (and SELECT) policies for `authenticated`, limited to `bucket_id = 'eatery-photos'`. Savorlog's owner is the first signed-in person to open `/savor` (check: Family → your name says Owner, and Reset link shows). After GitHub moves `ubuntu-latest` to Ubuntu 26 (Oct 19, 2026), check a run is still green.

## Resume prompt
> We're continuing Hanh's Log (repo hellohanh/hanhs-log, live at hellohanh.github.io/hanhs-log).
> Read SKILL.md (E1–E126, Q1–Q10, L1–L71), README.md, SESSION_LEDGER.md and docs/pin-standard.md
> first, plus CLAUDE.md for the working agreement. Hanh's Log has its own Supabase project and
> started from a clean slate (live Wanderlog is never touched). M3, M4 and M5 are live: trips +
> map + itinerary, all of Savorlog (catalogue, location gate, add/edit + photos, family invite),
> and Savorlog on trips (catalogue eateries by city, food-adds into the catalogue, eateries
> schedulable on days), every Nom-Nom cuisine has its dish list (E70), the **old-pin import queue**
> is built (E71, `/wander/import`, prepared file made by Claude), names follow `English : Local` (E72),
> travel blocks have the new look (E73), legs can be linked to another trip (E74), and trips can be
> edited from the list (E75). Maps have the GPins chip with a no-pins Map ID (E76) and a Map check (E77);
> packages are on vite 8 / React Router 7 (E78); the splash is lighter (E79). Since then: date-line
> repeat days (E80), 24-hour time menus (E81), one pin per place per trip (E82), a closable Savorlog
> place popup (E83), eyes on Places rows (E84), the map pin popup (E85), badges inside pins (E86),
> centring beside the itinerary panel (E87), and Title Case A–Z lists (E88). Session 11: Nom-Nom as an A–Z category (E89),
> the phone layout steps 1–2 (E90) and its Day route (E91), and Savorlog's City/Country field (E92). Session 12: cuisine menu A–Z (E93), Munch List (E94),
> Savorlog pins follow the map (E95), numbered bubbles (E96), smooth fly-over (E97), Hanh's line-art icons (E98, E99) and
> the new pin popup (E100). Session 13: the whole catalogue on every trip, Nom-Nom following the map (E101, migration 0015),
> the day's-city button (E102), the new-version notice (E103), phone sheets with cherry-red / mustard handles (E104),
> the phone splash (E105), the GPins icon (E106), Munch List on phones (E107) and no Munch List popup (E108). Session 14: MICHELIN Selected / Bib chips (E109), the Vibe box (E110),
> Google spelling (E111), double-click to edit (E112), MICHELIN-only (E113), new dishes (E114), copy pins (E115), block notes (E116),
> one link for several trips (E117), and **Roaminglog** — the shared spot catalogue on every trip and its Spot List at /roam (E119–E121,
> migrations 0021–0022). Session 15: offline (saved copy E122, waiting changes E123, the which-one-stays picker E124, migration 0023),
> the How-to page (E125) and the Your trips ☰ (E126). Next: try offline on the phone, phone step 3
> (add/edit forms, mockup first at 412 × 891), or the Map check results. Help me with the import as I work through it; the only deferred M5
> piece is **M5.2b** (now migration 0024 or later, forbidding new food pins in `pins`). Ask decisions as tappable multiple-choice questions, never
> infer, always show the merge link when something's ready to merge, and don't leave red build
> runs: fix them.

## Working agreement
- Every change goes on a branch and through a pull request; never push to main.
- Run `npm run build` before every push.
- All checks must be green before Hanh is asked to merge.
- Visual changes need a mockup or preview Hanh approves first.
- Database changes only as numbered migrations, applied by the approval-gated workflow, to Hanh's Log's own project. Never hand over SQL to paste. Never touch live Wanderlog's site or database.
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

Git history is the full record. A zip snapshot is also made at each Stop Protocol (latest: S015 OCT 20 2026).

## Database
Hanh's Log has its own Supabase project (live Wanderlog's database is never touched). It has its own rules, nightly
encrypted backups and an approval step before any change runs. See
[docs/database.md](docs/database.md).

## Tests
Every pull request runs:
- security tests, covering the owner, a stranger, an invited guest and a signed-out visitor;
- browser tests at phone, laptop, 150% zoom and a 2560 × 1440 monitor, including the signed-in Wanderlog screens against a stand-in database.

See [docs/testing.md](docs/testing.md).

## Running it on your own computer (optional)
```
npm install
npm run dev
```
Keep the folder on a local drive, in a path with no apostrophes or other quote
characters (see Wanderlog lesson L37).
