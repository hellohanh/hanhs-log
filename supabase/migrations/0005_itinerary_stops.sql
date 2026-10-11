-- Hanh's Log's own database, part 5: places on itinerary days (Hanh,
-- session 4, M3 step 4).
--
-- A pin can be dropped onto a day as a scheduled stop: a time block on that
-- day's timeline (like an activity), carrying the pin (its icon, colour and
-- status badge). The same pin can be on a day more than once. Connectors and
-- the day's route come next.
-- Everyone on a trip can read and change its stops; nobody else can see them
-- (same rule as activities, via day_on_my_trip from 0002). A stop's pin and
-- day must belong to the same trip.

create table if not exists public.itinerary_stops (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days (id) on delete cascade,
  pin_id uuid not null references public.pins (id) on delete cascade,
  start_time time not null,
  end_time time not null,
  note text check (note is null or char_length(note) <= 4000),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists itinerary_stops_day on public.itinerary_stops (day_id);
create index if not exists itinerary_stops_pin on public.itinerary_stops (pin_id);
alter table public.itinerary_stops enable row level security;
grant select, insert, update, delete on table public.itinerary_stops to authenticated;
create policy "people on a trip use its stops" on public.itinerary_stops
  for all to authenticated
  using (public.day_on_my_trip(day_id))
  with check (public.day_on_my_trip(day_id));

-- A stop's pin and day must be on the same trip (you can't schedule a pin
-- from one trip onto another trip's day).
create or replace function public.stop_pin_matches_day()
returns trigger
language plpgsql set search_path = public as $$
begin
  if (select d.trip_id from itinerary_days d where d.id = new.day_id)
     is distinct from (select p.trip_id from pins p where p.id = new.pin_id) then
    raise exception 'A stop''s pin and day must be on the same trip.';
  end if;
  return new;
end
$$;
create trigger itinerary_stops_same_trip before insert or update on public.itinerary_stops
  for each row execute function public.stop_pin_matches_day();
