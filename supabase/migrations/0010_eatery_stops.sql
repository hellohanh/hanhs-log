-- Hanh's Log's own database, part 10: scheduling eateries on itinerary days
-- (Savorlog on trips, M5). A stop was always a trip pin (0005); now it can be
-- a trip pin OR a shared catalogue eatery, so a restaurant (which now lives in
-- Savorlog, not as a trip pin) can be dropped onto a day like any other stop.
-- Exactly one of pin_id / eatery_id is set. A pin stop must still be on the
-- same trip as its day; an eatery stop must be within 20 km of one of the
-- trip's cities (the same places the trip shows, E60/trip_eateries).

alter table public.itinerary_stops alter column pin_id drop not null;
alter table public.itinerary_stops add column if not exists eatery_id uuid references public.eateries (id) on delete cascade;
create index if not exists itinerary_stops_eatery on public.itinerary_stops (eatery_id);
alter table public.itinerary_stops
  add constraint itinerary_stops_one_target check (num_nonnulls(pin_id, eatery_id) = 1);

-- A pin stop stays on its trip; an eatery stop must be in one of the trip's
-- cities (replaces the pin-only check from 0005).
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
  else
    if not exists (
      select 1 from eateries e
      where e.id = new.eatery_id and (
        (_t.map_lat is not null and public.dist_m(e.lat, e.lng, _t.map_lat, _t.map_lng) <= 20000)
        or (_t.city_secondary_lat is not null and public.dist_m(e.lat, e.lng, _t.city_secondary_lat, _t.city_secondary_lng) <= 20000)
        or (_t.city_tertiary_lat is not null and public.dist_m(e.lat, e.lng, _t.city_tertiary_lat, _t.city_tertiary_lng) <= 20000)
      )
    ) then
      raise exception 'An eatery can only be scheduled on a trip within 20 km of its cities.';
    end if;
  end if;
  return new;
end
$$;
