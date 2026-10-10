# Hanh's Log

One app for trip planning (**Wanderlog**) and eateries (**Savorlog**), sharing one
login and one database (its own Supabase project; the old Wanderlog site and
database are separate and untouched). Live at https://hellohanh.github.io/hanhs-log/

## Current state (Session 4, OCT 10 2026)

| Milestone | Status |
|---|---|
| M1 Foundation: design tokens, light and dark mode, header, routes, email sign-in, add to home screen | ✅ live |
| M2 Splash: scroll-driven paper plane that turns into the jet and lands, search and section panels, city search page | ✅ live (desktop); phone layout parked |
| M3 Wanderlog trips and map inside Hanh's Log | 🚧 steps 1–3 live (trips, sharing, the map); adding pins next |
| M4 Savorlog (Nom-Nom: cuisine → dish) | planned; pin standard designed |
| M5 Savorlog pins on trips, by city (20 km) | planned |
| M6 Wanderlog itinerary | planned |
| M7 Switch over from the old Wanderlog | planned |

## What's built
- **Splash (`/`)**:
  - Hanh's watercolor hero (Amalfi, phở, Eiffel Tower, bánh mì) in a 1080 × 800 container; its edge fades into the page's paper colour.
  - Scrolling flies Hanh's red paper plane (no shadow, `paper-plane-v2.webp`) along the route Hanh mapped; late in the flight it turns into the jet.
  - At the end the jet settles in the sky by the Eiffel Tower, and the search panel, Where to? section, and Wanderlog and Savorlog cards fade in.
  - With reduced motion, the page shows the finished picture straight away.
- **Wanderlog trip list (`/wander`)**: a clean slate in Hanh's Log's own database. Upcoming trips (soonest first) and past trips (faded), with cities · Country, dates, pin count (sorted pins only) and people, owned/shared labels; owner-only delete. **New trip** opens a popup: Trip name; Country (suggests as you type); Primary City (the map opens here), Secondary, Tertiary; dates optional; it shows "✓ Map opens on: …" before saving. Built for a 2560 × 1440 monitor first.
- **Trip page (`/wander/trip/<id>`)**: name, cities · Country and dates, people, Edit trip (same form), and Share & people (invite link, owner-only Reset link and Remove, first names).
- **Trip map**: opens on the Primary City's centre at zoom 13, no pins yet.
  - **Map look**: 11 looks. Defaults are Google standard (light) and Google dark (dark), remembered per mode on this device.
  - **Pins / No pins**: hides Google's shop, restaurant and landmark pins and keeps transit pins.
  - **Districts**: the old Wanderlog's coloured HCMC overlay; the chip shows whenever a district is in view.
  - **Camera control**: our own 3 × 4 control with tilt (10°), rotate (15°) and a reset button. Tilt works on Google's own looks; it's greyed out on hand-made looks and while pins are hidden.
- **Itinerary panel**: on the map's right edge (closed by default; 320 or 640 px, remembered): day tabs for the trip's dates plus extra days, day notes, and travel legs (flight, train, bus, own transport) on an hour timeline. Places, connectors and day routes come with pins.
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
M3 step 4: adding and editing pins, with a pins table in the new database and the add-pin form and pin drawing from the pin standard (teardrop pins, category colours, the MICHELIN pin). Settle Q3 and Q4 first, then mock up for approval. After that:
- step 4b: sort the old Wanderlog pins in from Hanh's export, one by one;
- step 5: the collapsed pinned list.

## Resume prompt
> We're continuing Hanh's Log (repo hellohanh/hanhs-log, live at hellohanh.github.io/hanhs-log).
> Read SKILL.md (E1–E49, Q1–Q8, L1–L33), README.md, SESSION_LEDGER.md and docs/pin-standard.md
> first, plus CLAUDE.md for the working agreement. Hanh's Log has its own Supabase project now and
> started from a clean slate (live Wanderlog is never touched). Session 4 finished M3 step 3 (the
> map). Start Session 5 with M3 step 4 (add/edit pins): settle Q3/Q4, then mock up for approval first.
> Ask me decisions as tappable multiple-choice questions.

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

Git history is the full record. A zip snapshot is also made at each Stop Protocol.

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
