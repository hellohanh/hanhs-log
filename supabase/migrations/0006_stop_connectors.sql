-- Hanh's Log's own database, part 6: connectors between a day's stops
-- (Hanh, session 6, M3 step 4).
--
-- A connector is the travel between two time-consecutive places on a day. It
-- stores only the chosen mode (walk, drive/Grab, transit, bike/motorbike);
-- the time and distance are fetched live from Google each time the day is
-- shown, never stored. A connector is keyed by the pair of stops it joins, so
-- if the stops stay consecutive its mode sticks; reorder the day and the old
-- pair's row simply stops being shown.
-- Everyone on a trip can read and change its connectors; nobody else can see
-- them (via day_on_my_trip, 0002). A connector's two stops must be on its day.

create table if not exists public.itinerary_connectors (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days (id) on delete cascade,
  from_stop_id uuid not null references public.itinerary_stops (id) on delete cascade,
  to_stop_id uuid not null references public.itinerary_stops (id) on delete cascade,
  mode text not null check (mode in ('walk', 'drive', 'transit', 'bike')),
  created_at timestamptz not null default now(),
  unique (from_stop_id, to_stop_id),
  check (from_stop_id <> to_stop_id)
);
create index if not exists itinerary_connectors_day on public.itinerary_connectors (day_id);
alter table public.itinerary_connectors enable row level security;
grant select, insert, update, delete on table public.itinerary_connectors to authenticated;
create policy "people on a trip use its connectors" on public.itinerary_connectors
  for all to authenticated
  using (public.day_on_my_trip(day_id))
  with check (public.day_on_my_trip(day_id));

-- A connector's two stops must both be on its day.
create or replace function public.connector_stops_on_day()
returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from itinerary_stops s where s.id in (new.from_stop_id, new.to_stop_id) and s.day_id = new.day_id) <> 2 then
    raise exception 'A connector''s stops must both be on its day.';
  end if;
  return new;
end
$$;
create trigger itinerary_connectors_same_day before insert or update on public.itinerary_connectors
  for each row execute function public.connector_stops_on_day();
