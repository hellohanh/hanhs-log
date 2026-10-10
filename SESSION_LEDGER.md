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

