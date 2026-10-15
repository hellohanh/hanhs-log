-- Hanh's Log's own database, part 13: repeat days for flights across the
-- date line (Hanh, session 10, approved mockup). Seoul 18:45 Sun Jan 3 →
-- Seattle 12:00 Sun Jan 3 lives Jan 3 twice, so a trip may now have a second
-- day with the same date: a repeat day, which sits right after the day it
-- follows (repeat_after = the departure date). The app adds it when a flight
-- needs it and removes it again when no flight does and nothing is on it.
-- (M5.2b "forbid new food pins" moves to the next free number, 0014.)
--
-- No data changes: every existing day keeps repeat_after empty.

alter table public.itinerary_days add column if not exists repeat_after date;

alter table public.itinerary_days drop constraint if exists itinerary_days_repeat_has_date;
alter table public.itinerary_days add constraint itinerary_days_repeat_has_date
  check (repeat_after is null or date is not null);

-- One ordinary day per date (as before) …
create unique index if not exists itinerary_days_one_per_date_v2
  on public.itinerary_days (trip_id, date) where date is not null and repeat_after is null;
-- … and one repeat day per date and departure date.
create unique index if not exists itinerary_days_one_repeat
  on public.itinerary_days (trip_id, date, repeat_after) where repeat_after is not null;
-- The old rule allowed only one day per date; the two above replace it.
drop index if exists public.itinerary_days_one_per_date;

-- Linking a leg to another trip (0012) puts it on that trip's ordinary day
-- for the departure date, never on a repeat day.
create or replace function public.link_travel_leg(_leg uuid, _trip uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare _src uuid; _date date; _day uuid;
begin
  select d.trip_id, coalesce(l.from_date, d.date) into _src, _date
    from travel_legs l join itinerary_days d on d.id = l.day_id where l.id = _leg;
  if _src is null or not public.is_on_trip(_src) then
    raise exception 'not allowed: that travel leg isn''t on your trip';
  end if;
  if not public.is_on_trip(_trip) then
    raise exception 'not allowed: you aren''t on that trip';
  end if;
  if _trip = _src then
    raise exception 'that leg is already on this trip';
  end if;
  if _date is null then
    raise exception 'the leg needs a departure date to be linked';
  end if;
  select id into _day from itinerary_days where trip_id = _trip and date = _date and repeat_after is null;
  if _day is null then
    insert into itinerary_days (trip_id, date) values (_trip, _date) returning id into _day;
  end if;
  insert into travel_leg_links (leg_id, trip_id) values (_leg, _trip) on conflict do nothing;
  return _day;
end $$;
revoke all on function public.link_travel_leg(uuid, uuid) from public, anon;
grant execute on function public.link_travel_leg(uuid, uuid) to authenticated;
