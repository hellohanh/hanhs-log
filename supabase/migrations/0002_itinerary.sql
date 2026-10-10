-- Hanh's Log's own database, part 2: the itinerary panel (Hanh, session 4).
--
-- The itinerary moved from its own tab into a right-hand panel on the map.
-- This adds what the panel needs before pins exist; scheduled stops come
-- with pins (step 4).
--
-- 1. itinerary_days: one row per day of a trip. Dated days cover the trip's
--    dates; extra undated days can be added. No stored day number: dated
--    days sort by date and undated days after them, so "Day N" is worked
--    out when the panel draws them (no renumbering, unlike old Wanderlog).
--    Each day has an optional free-text note (new in Hanh's Log).
-- 2. travel_legs: flights, trains, buses and own transport on a day, as in
--    old Wanderlog (carrier, reference, from/to place, date, time, zone).
-- Everyone on a trip (owner and members) can read and change its days and
-- legs; nobody else can see them.

-- 1. itinerary_days -----------------------------------------------------------
create table if not exists public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  date date,
  note text check (note is null or char_length(note) <= 4000),
  created_at timestamptz not null default now()
);
create unique index if not exists itinerary_days_one_per_date
  on public.itinerary_days (trip_id, date) where date is not null;
alter table public.itinerary_days enable row level security;
grant select, insert, update, delete on table public.itinerary_days to authenticated;
create policy "people on a trip use its days" on public.itinerary_days
  for all to authenticated
  using (public.is_on_trip(trip_id))
  with check (public.is_on_trip(trip_id));

-- Is this day on one of my trips? (Security definer so travel_legs' rule
-- can ask without looping through itinerary_days' own rule.)
create or replace function public.day_on_my_trip(_day uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from itinerary_days d where d.id = _day and public.is_on_trip(d.trip_id))
$$;
revoke all on function public.day_on_my_trip(uuid) from public, anon;
grant execute on function public.day_on_my_trip(uuid) to authenticated;

-- 2. travel_legs ---------------------------------------------------------------
create table if not exists public.travel_legs (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days (id) on delete cascade,
  mode text not null check (mode in ('flight', 'train', 'bus', 'personal')),
  title text,
  carrier text,
  reference text,
  from_location text not null check (char_length(btrim(from_location)) between 1 and 120),
  from_date date,
  from_time time,
  from_timezone text,
  to_location text not null check (char_length(btrim(to_location)) between 1 and 120),
  to_date date,
  to_time time,
  to_timezone text,
  created_at timestamptz not null default now()
);
alter table public.travel_legs enable row level security;
grant select, insert, update, delete on table public.travel_legs to authenticated;
create policy "people on a trip use its travel legs" on public.travel_legs
  for all to authenticated
  using (public.day_on_my_trip(day_id))
  with check (public.day_on_my_trip(day_id));
