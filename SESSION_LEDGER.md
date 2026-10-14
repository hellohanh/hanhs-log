# SESSION LEDGER — Hanh's Log
> Append-only. Never overwrite. One entry per session.

---

## Session 1 — 2026-10-09

**Goal:**
- Start Hanh's Log, the umbrella app for Wanderlog and the new Savorlog.
- Work out logistics and milestones.
- Set up a safer way of shipping than Wanderlog had.
- Build the foundation and the splash page.

**Decisions made:**
- E1–E22 recorded in SKILL.md, including:
  - the name and sections, the stack, the address, the MICHELIN-style look and dark mode;
  - the city search, Savorlog levels, sharing and the 20 km "in city" rule;
  - the PR-and-preview working agreement;
  - the flight path, scroll-driven flight, fade timing and the 1080 × 800 desktop layout;
  - sign-in hardening and the milestone order.

**Built and merged (all through pull requests with previews and green checks):**
- PR #1: build, deploy and pull-request preview pipeline.
- PR #2: database safeguards.
  - numbered migrations and a rules checker;
  - an approval-gated migrations workflow with a backup first;
  - nightly gpg-encrypted backups;
  - a read-only inspect workflow.
- PR #3: live schema snapshot workflow.
- PR #4: tests on every pull request.
  - two-person security tests (34 checks against the real live rules);
  - browser tests at phone, laptop and 150% zoom.
- PR #5: Milestone 1 foundation, plus Milestone 2 splash.
  - foundation: design tokens, light and dark mode, header, routes, sign-in, PWA;
  - splash: plane on Hanh's 66-dot route, hand-over to the painted plane, panels, city search results page.
- PR #6: splash desktop layout to Hanh's spec.
  - 1080 × 800 container, picture 40px down, panel 20px from the left with its bottom at 780px;
  - Where to? section pinned right under the picture, with its dark background fading in on landing.
- PR #7: sign-in switched on via GitHub Secrets.
  - the address is tidied automatically;
  - a mistyped setting can no longer blank the site;
  - errors name the address tried;
  - Hanh tested sign-in and sign-out end to end on the preview.

**Design work:**
- Splash mockup canvas, versions 1–12 (light, dark, phone).
- Inline flight-path editor, used by Hanh to map the 66-point route.
- Inline fade tuner, with dots that can be deleted, used to set the fade timing.

**Lessons:** L1–L13 recorded in SKILL.md.

**Open questions:**
- Q1: the splash phone layout (parked).
- Q2: the milestone 3 checklist.

**Stop Protocol completed:** zip `S001 OCT 9 2026 Hanhs Log.zip` produced and presented.

**Next session starts at:** Milestone 3, Wanderlog trips and map inside Hanh's Log. First lay out its checklist (from today's Wanderlog features) for Hanh to approve before any code.

---

## Session 2 — 2026-10-09 to 2026-10-10

**Goal:**
- Get caught up from the S001 zip, then start Milestone 3 (Wanderlog trips and map).
- Design one pin standard for Wanderlog and Savorlog.

**Decisions made:** E23–E34 recorded in SKILL.md (E13 replaced by E33). Highlights:
- Segoe UI on Wanderlog and Savorlog pages only (E23); desktop monitor 2560 × 1440 first (E24).
- M3 plan and order (E25); people by first name, owner-only remove/reset, owner and invite link protected (E26).
- Pin standard (E28–E34): teardrop pins, a 36 px MICHELIN pin with our own flower, Google icons plus Hanh's 43 drawings, a collapsed three-level pinned list, all non-food categories, and Nom-Nom (cuisine › dish, colour by region). Full detail in docs/pin-standard.md.

**Built and merged (all through pull requests with previews and green checks):**
- PR #8: Session 1 Stop Protocol docs.
- PR #9: Segoe UI fonts on Wanderlog and Savorlog pages.
- PR #10: Google Maps key and Map ID passed into builds; "Build settings" check in each run summary.
- PR #11: M3 step 1, the trip list at `/wander`; monitor size added to browser tests; stand-in Supabase for signed-in tests.
- PR #12: M3 step 2a, migration 0001 (first names, people list, owner-only remove and reset, owner/invite guard) with 28 new security checks; applied to the live database through the approval-gated workflow.
- PR #13: M3 step 2b, trip page, edit trip, Share & people, first-name prompt, invite links; people counts on trip cards.
- PR #14: this Stop Protocol (SKILL.md, README.md, SESSION_LEDGER.md, docs/pin-standard.md, 43 pin icons in `src/assets/pin-icons/`).

**Design work:**
- Canvas "Hanh's Log — Wanderlog M3 mockup": trip list and trip/map at 2560 × 1440, Share & people, pin baseline, pin shape options, and a decisions note.
- Inline previews for every pin decision; the "Nom-Nom icon review" page for the dish icons.
- Hanh's icon drawings (three sheets) traced to 43 SVGs.

**Lessons:** L14–L19 recorded in SKILL.md.

**Open questions:** Q1 (phone layout, parked), Q3 (tried it / rating), Q4 (Bib Gourmand box), Q5 (remaining cuisines' dishes), Q6 (five American icon names), Q7 (no lobster icon).

**Stop Protocol completed:** zip `S002 OCT 10 2026 Hanhs Log.zip` produced and presented.

**Next session starts at:** M3 step 3, the real map on the trip page with the new pin standard, desktop monitor first.


---

## Session 3 — 2026-10-10

**Goal:**
- Rework the splash: start as a paper airplane that fades into the jet, with the same fade values, on a new flight path.

**Decisions made:** E35–E38 recorded in SKILL.md (E15 updated; E17 and E18 reworded). Highlights:
- Paper plane takes off and turns into the jet at 0.68 with the landing's fades (E35); 86-point path from Hanh's editor (E15).
- Hanh's new hero with no plane painted in (E36); the jet lands as itself at 935, 233, 400 wide, tilted 4.75° (E37).
- Page paper #F6EFE2 matched to the new hero, with a soft faded edge (E38).

**Built and merged (all through pull requests with previews and green checks):**
- PR #15: paper plane, new path, new hero, landed jet; splash tests updated.
- PR #16: page paper matched to the new hero and the picture's edge softened.
- PR #14: Stop Protocol docs for sessions 2 and 3 (this entry).

**Design work:**
- Inline flight-path editor (draggable points, Play/scrub, paper-to-jet slider, sizes), then the same editor on the new hero with landed-jet size and tilt.
- Before/after comparison of the hero edge (Hanh chose option B).

**Lessons:** L20–L23 recorded in SKILL.md.

**Open questions:** unchanged: Q1, Q3–Q7.

**Stop Protocol completed:** zip `S003 OCT 10 2026 Hanhs Log.zip` produced and presented.

**Next session starts at:** M3 step 3, the real map on the trip page with the new pin standard, desktop monitor first.

---

## Session 4 — 2026-10-10

**Goal:**
- Get caught up from the S003 zip, then M3 step 3: the real map on the trip page.

**Decisions made:** E39–E48 recorded in SKILL.md (E22, E25, E27, E33 and E35 updated; Q8 added). Highlights:
- **Own database, clean slate** (E39, E40):
  - Hanh's Log moved to its own Supabase project, leaving live Wanderlog's site and database untouched so the two can be compared.
  - Wanderlog's database was given back exactly as before Hanh's Log.
  - Trips are rebuilt from scratch; old pins come from Hanh's export in step 4b.
- **Trip form** (E41): a New trip popup (also used for Edit trip) with Country and Primary / Secondary / Tertiary City, plus a "✓ Map opens on" check.
- **Opening view** (E42): the map opens on the Primary City's centre at zoom 13.
- **Map controls** (E43–E46):
  - 11 map looks; Google dark is the dark-mode default.
  - Our own 3 × 4 camera control with tilt, rotate and reset.
  - Pins / No pins chip (transit pins stay).
  - The old Wanderlog's coloured HCMC districts, with a chip that shows only while a district is in view.
- **Also** (E47, E48): trip cards count sorted pins only; paper plane v2.

**Built and merged (all through pull requests with previews and green checks):**
- #18, #19: the trip map and city lookup on the shared database (superseded by #20/#22).
- #20: Wanderlog's database given back as it was (migration 0003, now archived).
- #21: Map look panel closes on pick, ×, Escape and click outside.
- #22: Hanh's Log's own database, plus:
  - the new trip form and popup;
  - backups that skip an empty database;
  - a read-only connection check on previews.
- #23: updated paper airplane (`paper-plane-v2.webp`).
- #25: opening view at zoom 13.
- #26: old Wanderlog district overlay and colours.
- #28: camera control with tilt, rotate and reset; Google dark.
- #29: Pins / No pins chip; one Satellite look.
- #30: transit pins stay with No pins; Districts chip only when a district is in view.
- #32: the camera control starts closed.
- #33: map chips (Map look, Pins, Districts) as icons only.
- #35: day tabs wrap; click a time to add an activity, travel or (later) place; activity blocks with handles and drag-to-move (migration 0003, E50).
- #34: itinerary panel on the map (days, day notes, travel legs; migration 0002), replacing the Itinerary tab (E49).
- #31: this Stop Protocol (SKILL.md E39–E48, Q8, L24–L32; README; this entry; CLAUDE.md).
- Preview-only, closed without merging: #17 (map looks side by side), #24 (opening zoom), #27 (tilt test).

**Design work:**
- Trip map mockups v1 and v2.
- New trip form mockup.
- Inline camera-control mockups: 3 × 3, then 3 × 4.
- Inline itinerary-panel mockup; inline wrapped-tabs and click-to-add mockup.
- Live preview pages for map looks, zoom and tilt.

**Lessons:** L24–L34 recorded in SKILL.md.

**Correction to Session 3's entry:** session 3's Stop Protocol docs landed in PR #14, together with session 2's.

**Open questions:** Q1 (phone layout, parked), Q5–Q7, Q8 (Google dark pins/labels need a Google Cloud style, parked). Q3 → E51, Q4 → E52.

**Stop Protocol completed:** zip `S004 OCT 10 2026 Hanhs Log.zip` produced and presented.

---

## Session 5 — 2026-10-10

M3 step 4: adding and editing pins, and scheduling them onto itinerary days. Continued straight on from Session 4's map work.

**Decisions settled:** Q3 → E51 (WTG/VIS: status, verdict, half-star rating, badge colours; anyone's status shows, most recent VIS wins, average in the card only). Q4 → E52 (no Bib Gourmand box/chip — Bib places are "Mentioned"; one MICHELIN filter chip). Plus E53 (pins added only from the Google search box, category by hand), E54 (Show-all-pins / OTD Pins model), E55 (import order), E56 (places on days: four add methods), E57 (OTD Pins fade rule, `pinFaded`).

**Shipped (all merged to main):**
- #37: No-pins keeps park names.
- #38: Pins add/edit — migration `0004_pins` (pins + pin_reviews), the Places panel, the add/edit card, pins drawn on the map, Show-all-pins and MICHELIN chips. Trip cards count pins. (E51–E55)
- #39: CI — deploy/preview emit a "Map" annotation saying whether the vector Map ID reached the build.
- #40: Places on itinerary days — migration `0005_itinerary_stops`, stops as time blocks, four ways to add (drag → day tab / timeline slot, the Add popup's Place picker, a + on each list row, the card's Add to day), OTD Pins. (E56–E57)

**Design work:** inline mockups for the WTG/VIS badges (re-shown with Hanh's colours), the MICHELIN pin levels, the add-pin form, places-on-days timeline blocks, the Add-to-day button placements.

**Diagnosed (not a code bug):** greyed tilt/rotate on Google's own looks — `VITE_GOOGLE_MAP_ID` is set and the Maps key is accepted, so the fix is a **Vector** Map ID in the **same Google Cloud project** as the key (Console change). The #39 annotation now surfaces this on every run.

**Lessons:** L35–L38 recorded in SKILL.md.

**New standing preference:** always show the merge link when something is ready to merge, without being asked.

**Open questions:** Q1 (phone layout, parked), Q5 (remaining cuisines' dishes), Q6 (five American icon names), Q7 (no lobster icon), Q8 (Google-dark pins/labels need a Google Cloud style, parked).

**Stop Protocol completed:** zip `S005 OCT 10 2026 Hanhs Log.zip` produced and presented.

**Next session starts at:** the itinerary's connectors between stops (walk/drive/Grab/transit/bike with Google times) and the day's route on the map + route popup; then step 5 (the collapsed three-level pinned list tree). Then M4 Savorlog, M5, the old-pin import (after Savorlog), M7 switch-over.

---

## Session 6 — 2026-10-11

**Goal:**
- Finish M3 (the itinerary's connectors + day route, and the pinned-list tree).
- Build all of M4 Savorlog: the shared eatery catalogue, its page, add/edit, and the family invite.

**Decisions made:**
- E58–E68 recorded in SKILL.md, including:
  - connectors between a day's stops and the day's route drawn on the map (E58, E59);
  - Savorlog = one shared, trip-independent eatery catalogue held by a single family circle, surfaced on a trip within 20 km of its cities; non-food pins stay trip-scoped; "one store", catalogue starts empty (E60);
  - anyone who can see an eatery can add/edit it; two-stage delete (a pending-deletion queue the owner confirms); all three trip cities get coordinates (E61–E63);
  - the Savorlog page (country → dish tree + map), a required location gate (country→mainland / city→zoom 13), the add/edit card with price $–$$$$ and photos (uploads → Google photo → placeholder), and the signed-in-family-only invite (E64–E68).
- Q9 (price scale) and Q10 (photos) resolved → E67.

**Built and merged (all through pull requests with previews and green checks):**
- #42: Connectors between stops — migration `0006_stop_connectors`.
- #43: Day route on the map (retired OTD Pins).
- #44: Pinned list as a collapsible tree (M3 step 5) + formal title-case on save.
- #45: Savorlog 4b data model — migration `0007_eateries` (catalogue, one circle, 20 km surfacing, two-stage delete, RLS).
- #46: Savorlog 4c — the catalogue page + the required location gate.
- #47: Savorlog 4d — add/edit eatery; migration `0008_eatery_photos` (metadata); price, photos, review, Remove→queue.
- #48: Savorlog 4e — the family invite; migration `0009_savorlog`.
- #49: Landed 4d+4e on `main` (the stacked PRs #47/#48 had merged into intermediate branches, not main).

**Design work:** inline mockups for the dashed-C connectors (heavily iterated), the day-route overlay, the Savorlog page (two directions + an interactive version), the location gate, and the add/edit eatery card with the photo fallback states.

**Lessons:** L39 (non-ASCII `\b` in Playwright name regexes; diacritic-stripping test stubs) and L40 (keep Supabase Storage buckets as one-time dashboard setup; migrate only the metadata table) recorded in SKILL.md.

**Process note:** stacked PRs merge into their base branch, not `main` — a chain targeting intermediate branches needs a final PR to `main` (that was #49). Go straight to a single land-on-main PR next time.

**Still manual on Hanh's side (not code):** run the Database-migrations workflow + approve to apply **0007, 0008, 0009**; make the public **`eatery-photos`** Storage bucket (docs/database.md) so eatery photo uploads work.

**Open questions:** Q1 (phone layout, parked), Q5 (remaining cuisines' dishes), Q6 (five American icon names), Q7 (no lobster icon), Q8 (Google-dark pins/labels, parked).

**Stop Protocol completed:** zip `S006 OCT 11 2026 Hanhs Log.zip` produced and presented.

**Next session starts at:** M5 — Savorlog on trips (surface catalogue eateries on a trip's map/Places by city; route trip food-adds into the catalogue). Then the old-Wanderlog pin import, M6 itinerary polish, M7 switch-over.

---

## Session 7 — 2026-10-11 to 2026-10-12

**Goal:**
- Build all of **M5 — Savorlog on trips**: show the catalogue's eateries on a Wanderlog trip by city, route trip food-adds into the shared catalogue, and let an eatery be scheduled onto an itinerary day.

**Decisions settled (all under E69, plan recorded in session 6):**
- Picking the **Nom-Nom** category in a trip's add card hands off to the full Savorlog add panel, saving to the shared catalogue, not a trip pin.
- A trip **shows** the catalogue's eateries within 20 km of its cities (`trip_eateries`) alongside its non-food pins; opening one uses the Savorlog edit card.
- An itinerary stop can be a trip **pin or** a Savorlog **eatery** (exactly one); a scheduled eatery must be within 20 km of a trip city.
- Pins and eateries are flattened to one `StopItem` so the whole stop UI (timeline block, edit/retime/remove, drag-and-drop, Add-popup Place picker, connectors, Day route) handles both.
- **Deferred:** M5.2b — a migration forbidding *new* food pins in `pins` — left to land with its own test rework.

**Built and merged (all through pull requests with previews and green checks):**
- #51: **M5.1 schema** — migration `0010_eatery_stops` (`itinerary_stops` references a pin **or** an eatery; 20 km rule for eatery stops; trigger `stop_pin_matches_day()` rewritten).
- #52: **M5.2 add-switch + M5.3 show-on-trip** — `PinForm.onFood` hands dining off to `SavorForm`; the trip Places panel's "Nom-Nom · from Savorlog" section (`fetchTripEateries`) and eateries drawn on the trip map; shared `EateryTree`; the map pin overlay extracted to `mapPinLayer.ts` (shared by `TripMap` and `SavorMap`).
- #53: **M5.4 schedule eateries on days** — `StopItem` / `StopKind` / `stopRef` / `parseStopRef` / `stopTarget` in `lib/itinerary.ts`; `ItineraryPanel`, `StopBlock`/`StopEdit`, the Add popup picker, drag-and-drop, connectors and the Day route all resolve a pin or an eatery; `EateryTree` rows draggable + an "Add to day" + on a trip.

**Tests:** `tests/browser/savor-trip.spec.ts` extended (trip shows eateries; Nom-Nom add-switch saves to the catalogue, not a pin; an eatery schedules onto a day carrying `eatery_id`, not `pin_id`). No new `tests/db` test this session — migration 0010 shipped in #51 with its own test; #52/#53 are front-end only. Suite green at phone / laptop / 150% zoom / monitor.

**Lessons:** none new (M5.4 landed clean; the stale-`dist` and non-ASCII-regex pitfalls were already L35/L39 from session 6).

**Still manual on Hanh's side (not code):** run the Database-migrations workflow + approve to apply **0007, 0008, 0009, 0010**; make the public **`eatery-photos`** Storage bucket (docs/database.md) so eatery photo uploads work.

**Open questions:** Q1 (phone layout, parked), Q5 (remaining cuisines' dishes), Q6 (five American icon names), Q7 (no lobster icon), Q8 (Google-dark pins/labels, parked).

**Stop Protocol completed:** zip `S007 OCT 11 2026 Hanhs Log.zip` produced and presented.

**Next session starts at:** the **old Wanderlog pin import** (E55) — Hanh provides the export; sort the pins in city by city. Then M5.2b (migration 0011 forbidding new food pins), M6 itinerary polish, M7 switch-over.

---

## Session 8 — 2026-10-12

**Goal:**
- Get caught up from the S007 zip; clear the one-time setup; settle Q5 before the old-pin import.

**Decisions made:**
- **Q5 → E70**: top-5 dishes for every remaining cuisine (Japanese, Korean, Chinese, Taiwanese, Cantonese / HK, Indian, Italian, French, Spanish, Greek, Mediterranean, American, Southern / soul food, Cajun / Creole, Tex-Mex, Mexican) and Café, Bakery / dessert, Bar / drinks, approved as drafted; **Fusion has no dish list**.
- Hanh doesn't want red build runs left as "harmless": fix them (L41, L42).

**Built and merged (all through pull requests with previews and green checks):**
- #54: Session 7 Stop Protocol docs.
- #55: **Q5 / E70** — the dish lists in `pinCatalog.ts`, 18 Material Symbols added to `materialIcons.ts`, a test that every catalogue icon is shipped; docs/pin-standard.md.
- #56: **Pages publish guard** — `scripts/pages-guard.sh` in Deploy site and PR preview (wait for any running Pages job; confirm GitHub published; on a hiccup request a fresh build and delete the failed run). L41.
- #57: **Node 24** — checkout / setup-node / upload-artifact v4 → v6; `rossjrw/pr-preview-action` replaced by our own publish/remove steps (`JamesIves/github-pages-deploy-action@v4`) and `scripts/preview-comment.sh` (same link and hidden marker, QR kept, posted after Pages publishes). L42.

**Done outside code:**
- Confirmed migrations 0001–0010 were already applied (approved runs after #45, #49, #51; the preview connection check lists them).
- Hanh created the public `eatery-photos` bucket: INSERT, DELETE, SELECT policies for `authenticated`, definition `bucket_id = 'eatery-photos'` (not `true`).
- Deleted two red Actions runs: #159 (GitHub's Pages job, "Multiple artifacts named github-pages"; re-runs can never pass) and a session-1 Checks run (Oct 9). Actions has 0 failed runs.
- Explained ownership: Savorlog's owner is the first signed-in visitor of `/savor` (Family → Owner + Reset link); Wanderlog ownership is per trip ("You own this" badge; Share & people → Owner).

**Lessons:** L41 (overlapping gh-pages publishes; the guard), L42 (Node 24 actions; check `runs.using` before bumping).

**Open questions:** Q1 (phone layout, parked), Q6 (American icon names: chicken bucket, curly fries, chili bowl, side bowl), Q7 (no lobster icon), Q8 (Google-dark pins/labels, parked).

**Stop Protocol completed:** zip `S008 OCT 12 2026 Hanhs Log.zip` produced and presented.

**Next session starts at:** the **old Wanderlog pin import** (E55) — first ask Hanh how: sort with Claude from the export, Hanh adds them in the app, or a bulk importer. Then M5.2b (migration 0011), Q6/Q7, M6, M7. After Oct 19, 2026 check a run on Ubuntu 26.

---

## Session 9 — 2026-10-13

**Goal:**
- Get caught up from the S008 zip; start the old Wanderlog pin import (E55).

**Decisions made:**
- **E71** old-pin import queue: Claude prepares the export (real city, English : Local, category guess, MICHELIN check for every food place, merged copies); Hanh loads it once and goes city → trip → category (standard order) → prefilled add card; Save and next / Skip for good / Back; progress in the database; Savorlog owner only; pins only (no itineraries).
- **E72** naming standard `English : Local` (Japan: native script + romaji in brackets), two name boxes; small words lower-case in title case.
- **E73** travel legs: Title first for every mode; blocks show `CITY (CODE)`, time zones (US short name + offset, elsewhere offset), `•••🛬•••` (🚆, 🚌 and 🚗 mirrored), no logo square.
- **E74** linked travel legs: copy icon → pick a trip; one leg on both trips, read only on the other, delete removes everywhere.
- **E75** edit a trip from its card.
- M5.2b (forbid new food pins) moves to migration **0013**.

**Built and merged (all through pull requests with previews and green checks):**
- #58: Session 8 Stop Protocol docs.
- #59: migration **0011** `pin_import_items` (+13 security checks) — applied.
- #60: two name boxes, English : Local (E72).
- #61: travel Title first for every mode, shown on the block.
- #62: the import queue `/wander/import` (E71).
- #63: Pages guard — a job cancelled for a newer publish counts as published (L43).
- #64: travel block look (E73).
- #65: migration **0012** `travel_leg_links` + copy-to-another-trip (E74, +14 security checks) — applied.
- #66: ✎ Edit trip on each trip card (E75).

**Done outside code:**
- Prepared `hanhs-log-import-2026-10-13.json` from the 236-pin export: 227 places, 14 cities; 15 MICHELIN matches (★ Ănăn Saigon, Gia, Tầm Vị; 12 Mentioned); Nha Trang / Hội An / Huế / Đà Lạt aren't in the guide. Sent to Hanh (not in the repo).
- Deleted stale Pages run #172 (re-runs can never pass, L43). Actions has 0 failed runs.

**Design work:** inline mockups for the import queue, the name boxes, the travel block (time-zone style, per-mode emoji flips, plane choice), linked legs, and the edit pencil.

**Lessons:** L43 (superseded Pages jobs; never re-run one), L44 (no blanket `git checkout -- .` with uncommitted work).

**Open questions:** Q1 (phone layout, parked), Q6 (American icon names), Q7 (no lobster icon), Q8 (Google-dark pins/labels, parked).

**Stop Protocol completed:** zip `S009 OCT 13 2026 Hanhs Log.zip` produced and presented.

**Next session starts at:** helping Hanh through the import queue; then M5.2b (migration 0013), Q6/Q7, M6, M7. After Oct 19, 2026 check a run on Ubuntu 26.

---

## Session 10 — 2026-10-14

**Goal:**
- Make every map control work on Google's looks with GPins ON and OFF; check GitHub health; fix the computer slowing down on the site.

**Decisions made:** E76 (GPins chip + no-pins Map ID; Q8 resolved), E77 (Map check), E78 (package majors), E79 (splash edge baked in; replaced maps cleaned up).

**Built and merged (all through pull requests with previews and green checks):**
- #67: Session 9 Stop Protocol docs.
- #68: GPins ON / OFF chip, no-pins Map ID path, Map check, builds report the new secret.
- #69: React Router 7, vite 8, PWA plugin 2, React plugin 5.2, Playwright 1.64, Maps types 3.66 — `npm audit` 5 → 0.
- #70: splash soft edge baked into `hero-feathered.webp` (2,151 → 325 ms raster per 4 s scroll); replaced Google maps removed instead of piling up.

**Done outside code:**
- Google Cloud (project chord-book-tts): styles **Hanh's Log – no pins** (Hanh's JSON) and **Hanh's Log – no pins (dark)**, Map ID **Hanh's Log no pins** `1d7efe6a09082e4f21979b9e` (Vector, both styles attached, Buildings → 3D). The secret first held the style ID (L46); corrected and the live site redeployed. Hanh confirmed GPins OFF hides pins with tilt and 3D buildings on Google standard and dark.
- GitHub check-up: 0 failed runs, migrations 0001–0012 applied, nightly backup ran (late). Branch deletion blocked by the session proxy (L47) — left to Hanh.
- Performance audit: every page idle-tested signed in (no loops, timers, leaks or repeated requests); the splash blur mask was the cost.

**Lessons:** L45 (live SVG blur mask re-rasterises per frame), L46 (Map Style ID ≠ Map ID; default style slots; 3D not in JSON), L47 (proxy limits; pkill self-kill).

**Open questions:** Q1 (phone layout, parked), Q6 (American icon names), Q7 (no lobster icon).

**Stop Protocol completed:** zip `S010 OCT 14 2026 Hanhs Log.zip` produced and presented.

**Next session starts at:** the Map check results (Terrain / Satellite), then the old-pin import, M5.2b (migration 0013), Q6/Q7, M6, M7. After Oct 19, 2026 check a run on Ubuntu 26.
