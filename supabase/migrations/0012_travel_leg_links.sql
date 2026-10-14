-- Hanh's Log's own database, part 12: travel legs linked to other trips
-- (Hanh, session 9). A long layover becomes its own trip (e.g. Tokyo), so a
-- flight can be "copied" to another trip — linked, not duplicated: the one leg
-- shows on both trips, on the day matching its departure date.
--
-- Rules (approved):
-- - Only someone on BOTH trips can link a leg (the copy icon → pick a trip);
--   the day is added to the other trip if it doesn't have that date yet.
-- - People on the other trip can SEE the leg but not change it (they're shown
--   where to edit it); only the leg's own trip can edit it.
-- - Deleting the leg deletes it everywhere (the links cascade).
-- (M5.2b "forbid new food pins" moves to the next free number, 0013.)

create table if not exists public.travel_leg_links (
  leg_id uuid not null references public.travel_legs (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (leg_id, trip_id)
);
alter table public.travel_leg_links enable row level security;
grant select on table public.travel_leg_links to authenticated;

-- Is this leg on one of my trips (its own trip)?
create or replace function public.leg_on_my_trip(_leg uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from travel_legs l where l.id = _leg and public.day_on_my_trip(l.day_id))
$$;
revoke all on function public.leg_on_my_trip(uuid) from public, anon;
grant execute on function public.leg_on_my_trip(uuid) to authenticated;

create policy "people on either trip see a link" on public.travel_leg_links
  for select to authenticated
  using (public.is_on_trip(trip_id) or public.leg_on_my_trip(leg_id));

-- People on the other trip can read a leg linked to it (read only: the
-- existing "for all" rule still limits changes to the leg's own trip).
create policy "people on a linked trip see the leg" on public.travel_legs
  for select to authenticated
  using (exists (select 1 from travel_leg_links k where k.leg_id = id and public.is_on_trip(k.trip_id)));

-- Link a leg to another trip (both must be yours); adds the departure day
-- there if missing. Returns that day's id.
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
  select id into _day from itinerary_days where trip_id = _trip and date = _date;
  if _day is null then
    insert into itinerary_days (trip_id, date) values (_trip, _date) returning id into _day;
  end if;
  insert into travel_leg_links (leg_id, trip_id) values (_leg, _trip) on conflict do nothing;
  return _day;
end $$;
revoke all on function public.link_travel_leg(uuid, uuid) from public, anon;
grant execute on function public.link_travel_leg(uuid, uuid) to authenticated;

-- For a trip's itinerary: every link touching it, with the other trip's name
-- (names of trips you aren't on are otherwise hidden). 'out' = this trip's leg
-- also shows elsewhere; 'in' = another trip's leg shows here.
create or replace function public.trip_leg_links(_trip uuid)
returns table (leg_id uuid, direction text, other_trip_id uuid, other_trip_name text)
language sql stable security definer set search_path = public as $$
  select k.leg_id, 'out', t.id, t.name
    from travel_leg_links k
    join travel_legs l on l.id = k.leg_id
    join itinerary_days d on d.id = l.day_id
    join trips t on t.id = k.trip_id
   where d.trip_id = _trip and public.is_on_trip(_trip)
  union all
  select k.leg_id, 'in', t.id, t.name
    from travel_leg_links k
    join travel_legs l on l.id = k.leg_id
    join itinerary_days d on d.id = l.day_id
    join trips t on t.id = d.trip_id
   where k.trip_id = _trip and public.is_on_trip(_trip)
$$;
revoke all on function public.trip_leg_links(uuid) from public, anon;
grant execute on function public.trip_leg_links(uuid) to authenticated;
