-- Roaminglog move preview (session 14): NUMBERS ONLY, never names or notes.
-- How many non-food trip pins would move into the spot catalogue (0022),
-- how many distinct places they are, and what comes along with them.
\pset tuples_only on
\pset format unaligned
\pset fieldsep ' '
select 'nonfood_pins=' || count(*) from public.pins where category <> 'food';
select 'distinct_google_places=' || count(distinct google_place_id) from public.pins where category <> 'food' and google_place_id is not null;
select 'pins_without_google_place=' || count(*) from public.pins where category <> 'food' and google_place_id is null;
select 'trips_with_nonfood_pins=' || count(distinct trip_id) from public.pins where category <> 'food';
select 'itinerary_blocks_on_them=' || count(*) from public.itinerary_stops s join public.pins p on p.id = s.pin_id where p.category <> 'food';
select 'wtg_vis_on_them=' || count(*) from public.pin_reviews r join public.pins p on p.id = r.pin_id where p.category <> 'food';
select 'food_pins_staying=' || count(*) from public.pins where category = 'food';
