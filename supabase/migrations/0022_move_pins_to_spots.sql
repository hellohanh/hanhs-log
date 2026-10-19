-- Hanh's Log's own database, part 22: move the non-food trip pins into the
-- Roaminglog spot catalogue (session 14, step 2 of the Roaminglog plan).
-- Preview (Inspect database, Oct 19 2026): 77 non-food pins on 6 trips,
-- 65 distinct Google places (12 copies merge), 4 itinerary blocks and 77
-- WTG / VIS on them, no pins without a Google place, no food pins.
-- Hanh's merge rules for the same place pinned on several trips:
--   * place details (name, address, category…): the most recently added copy;
--   * notes: joined, one per line, each different note once, oldest first;
--   * each person's WTG / VIS: a VIS beats WTG; between two of the same
--     kind, the most recent.
-- Itinerary blocks are re-pointed at the spot (a stop can now be a pin, an
-- eatery or a spot), then the moved pins are removed — their reviews were
-- copied first. The migrations workflow takes a backup before this runs.
-- allow-destructive: removes the 77 non-food trip pins (and their pin_reviews)
-- only after each is copied into spots / spot_reviews and its itinerary blocks
-- are re-pointed (Hanh approved the move, session 14); food pins are untouched.

-- 1. A stop can point at a spot. ------------------------------------------------
alter table public.itinerary_stops add column if not exists spot_id uuid references public.spots (id) on delete cascade;
create index if not exists itinerary_stops_spot on public.itinerary_stops (spot_id);
alter table public.itinerary_stops drop constraint if exists itinerary_stops_one_target;
alter table public.itinerary_stops
  add constraint itinerary_stops_one_target check (num_nonnulls(pin_id, eatery_id, spot_id) = 1);

-- A pin stop stays on its trip; an eatery or spot must be a live catalogue
-- entry the person scheduling can see (replaces 0015's version).
create or replace function public.stop_pin_matches_day()
returns trigger
language plpgsql set search_path = public as $$
declare _t public.trips%rowtype;
begin
  select * into _t from trips where id = (select d.trip_id from itinerary_days d where d.id = new.day_id);
  if new.pin_id is not null then
    if _t.id is distinct from (select p.trip_id from pins p where p.id = new.pin_id) then
      raise exception 'A stop''s pin and day must be on the same trip.';
    end if;
  elsif new.spot_id is not null then
    if not exists (select 1 from spots s where s.id = new.spot_id and s.deleted_at is null) then
      raise exception 'That place isn''t in Roaminglog.';
    end if;
  else
    if not exists (select 1 from eateries e where e.id = new.eatery_id and e.deleted_at is null) then
      raise exception 'That eatery isn''t in the catalogue.';
    end if;
  end if;
  return new;
end
$$;

-- 2. One spot per Google place, from the most recently added copy. -------------
create temp table moving on commit drop as
  select p.*, row_number() over (partition by coalesce(p.google_place_id, p.id::text) order by p.created_at desc, p.id) as rn
  from public.pins p
  where p.category <> 'food';

insert into public.spots (google_place_id, name, address, lat, lng, category, subcategory, subsubcategory, note, created_by, created_at)
select m.google_place_id, m.name, m.address, m.lat, m.lng, m.category, m.subcategory, m.subsubcategory,
       -- every different note once, oldest first, one per line
       (select string_agg(n.note, E'\n' order by n.first_at)
          from (select x.note, min(x.created_at) as first_at
                  from moving x
                  where coalesce(x.google_place_id, x.id::text) = coalesce(m.google_place_id, m.id::text)
                    and x.note is not null and btrim(x.note) <> ''
                  group by x.note) n),
       m.created_by,
       (select min(x.created_at) from moving x where coalesce(x.google_place_id, x.id::text) = coalesce(m.google_place_id, m.id::text))
from moving m
where m.rn = 1
on conflict (google_place_id) where google_place_id is not null do nothing;

-- Each moved pin → its spot.
create temp table pin_spot on commit drop as
  select m.id as pin_id, s.id as spot_id
  from moving m
  join public.spots s on s.google_place_id = m.google_place_id;

-- 3. Everyone's WTG / VIS: a VIS beats WTG, then the most recent. ---------------
insert into public.spot_reviews (spot_id, user_id, status, verdict, rating, updated_at)
select distinct on (ps.spot_id, r.user_id)
       ps.spot_id, r.user_id, r.status, r.verdict, r.rating, r.updated_at
from public.pin_reviews r
join pin_spot ps on ps.pin_id = r.pin_id
order by ps.spot_id, r.user_id, (r.status = 'vis') desc, r.updated_at desc
on conflict (spot_id, user_id) do nothing;

-- 4. Itinerary blocks follow their place. ----------------------------------------
update public.itinerary_stops st
set spot_id = ps.spot_id, pin_id = null
from pin_spot ps
where st.pin_id = ps.pin_id;

-- 5. The moved pins go (their reviews were copied above). ------------------------
delete from public.pins p using pin_spot ps where p.id = ps.pin_id;
