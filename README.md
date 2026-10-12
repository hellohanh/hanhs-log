# Hanh's Log

One app for trip planning (**Wanderlog**) and eateries (**Savorlog**), sharing one
login and one database (its own Supabase project; the old Wanderlog site and
database are separate and untouched). Live at https://hellohanh.github.io/hanhs-log/

## Current state (Session 7, OCT 11 2026)

| Milestone | Status |
|---|---|
| M1 Foundation: design tokens, light and dark mode, header, routes, email sign-in, add to home screen | ✅ live |
| M2 Splash: scroll-driven paper plane that turns into the jet and lands, search and section panels, city search page | ✅ live (desktop); phone layout parked |
| M3 Wanderlog trips and map inside Hanh's Log | ✅ live (trips, sharing, the map, pins, places on itinerary days, connectors + day route, the pinned-list tree) |
| M4 Savorlog (Nom-Nom: cuisine → dish) | ✅ live (shared catalogue, location gate, add/edit + photos, family invite) |
| M5 Savorlog eateries on trips, by city (20 km) | ✅ live (catalogue eateries show on a trip by city, food-adds route into the catalogue, eateries schedulable on days; only "forbid new food pins" deferred) |
| Old Wanderlog pin import (after Savorlog, before switch-over) | next |
| M6 Wanderlog itinerary polish | planned |
| M7 Switch over from the old Wanderlog | planned |

## What's built
- **Splash (`/`)**:
  - Hanh's watercolor hero (Amalfi, phở, Eiffel Tower, bánh mì) in a 1080 × 800 container; its edge fades into the page's paper colour.
  - Scrolling flies Hanh's red paper plane (no shadow, `paper-plane-v2.webp`) along the route Hanh mapped; late in the flight it turns into the jet.
  - At the end the jet settles in the sky by the Eiffel Tower, and the search panel, Where to? section, and Wanderlog and Savorlog cards fade in.
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
- **Savorlog (`/savor`)**: one shared eatery catalogue, filed cuisine-country → main dish, held by a single family **circle** and belonging to no trip. Opening it asks **where** first — a country (framed to its mainland) or a city (zoom 13); the catalogue tree and the map then show only that place's eateries. A Google **search-to-add** opens the add/edit card: cuisine → dish, **price $–$$$$**, MICHELIN, Street food / Fine dining, your WTG/VIS + rating, a note, and up to **3 photos** (uploads → a Google place photo → a "Photo coming soon" placeholder). **Remove** sends an eatery to a pending-deletion queue the owner confirms. A **Family** button shares a signed-in-family-only invite (`/savor/join/<code>`) with owner-only reset/remove. The same eatery shows on any trip within 20 km of its cities (M5): a trip's Places panel lists them under **Nom-Nom · from Savorlog**, the map draws them, picking the Nom-Nom category while adding a place on a trip opens this same add panel (saving to the catalogue, not a trip pin), and an eatery can be scheduled onto an itinerary day like a pin.
- **Invite links (`/wander/join/<code>`)**: signed-in people join straight away; others tap Join trip (no email) and are asked for a first name.
- **City search (`/search?city=…`)**: one results page per city; trips and eateries fill in later.
- **Sign in (`/signin`)**: email link through Hanh's Log's own Supabase project.
- **Fonts**: Segoe UI inside Wanderlog and Savorlog; Newsreader and Public Sans on the splash and header.
- **Pin standard**: every category, colour and icon for Wanderlog and Savorlog pins is in [docs/pin-standard.md](docs/pin-standard.md); Hanh's own icons are in `src/assets/pin-icons/`.
- **Safety net**:
  - every pull request gets a preview link, a build check, migration rules, two-person security tests and browser tests at phone, laptop, 150% zoom and monitor sizes;
  - database changes run only through the approval-gated migrations workflow, after a backup;
  - backups run nightly, encrypted;
  - every preview build runs a read-only connection check (website project, sign-in settings, database).

## What's next
1. **Old Wanderlog pin import** from Hanh's export, sorted city by city (after Savorlog, before the switch-over, E55).
2. **M5.2b** — a migration (`0011`) forbidding new food pins in the `pins` table going forward (existing ones left alone), landed with its test rework. The only deferred piece of M5.
3. **M6** itinerary polish, then **M7** switch-over.

Also open: **Q5** (dishes for the remaining cuisines), **Q6** (five American icon names), **Q7** (no lobster icon), **Q1** (splash phone layout, parked), **Q8** (Google-dark pins/labels need a Google Cloud style, parked). And the **tilt** needs a **Vector** `VITE_GOOGLE_MAP_ID` in the same Google Cloud project as the Maps key (a Console change, not code).

**Two one-time setup steps on Hanh's side** (not code): run the Database-migrations workflow + approve to apply **0007/0008/0009/0010**; and make the public **`eatery-photos`** Storage bucket (docs/database.md) so eatery photo uploads work.

## Resume prompt
> We're continuing Hanh's Log (repo hellohanh/hanhs-log, live at hellohanh.github.io/hanhs-log).
> Read SKILL.md (E1–E69, Q1–Q10, L1–L40), README.md, SESSION_LEDGER.md and docs/pin-standard.md
> first, plus CLAUDE.md for the working agreement. Hanh's Log has its own Supabase project and
> started from a clean slate (live Wanderlog is never touched). M3, M4 and M5 are live: trips +
> map + itinerary, all of Savorlog (catalogue, location gate, add/edit + photos, family invite),
> and Savorlog on trips (catalogue eateries by city, food-adds into the catalogue, eateries
> schedulable on days). Start the **old Wanderlog pin import** (E55): I'll give you the export;
> sort the pins in city by city with me. The only deferred M5 piece is **M5.2b** (migration 0011
> forbidding new food pins in `pins`). Ask decisions as tappable multiple-choice questions, never
> infer, and always show the merge link when something's ready to merge.

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

Git history is the full record. A zip snapshot is also made at each Stop Protocol (latest: S007 OCT 11 2026).

## Database
The database is shared with Wanderlog, so it has its own rules, nightly
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
