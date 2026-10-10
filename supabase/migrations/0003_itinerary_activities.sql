-- Hanh's Log's own database, part 3: activity blocks (Hanh, session 4).
--
-- Clicking a time slot in the itinerary panel can add an activity: a
-- free-text block with a start and end time on one day (e.g. "Massage at
-- Miu Miu Spa", 15:00–15:30). Activities can be resized and moved by
-- dragging. Places (with pins) and travel legs are separate.
-- Everyone on a trip can read and change its activities; nobody else can
-- see them (same rule as travel legs, via day_on_my_trip from 0002).

create table if not exists public.itinerary_activities (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.itinerary_days (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  start_time time not null,
  end_time time not null,
  note text check (note is null or char_length(note) <= 4000),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
alter table public.itinerary_activities enable row level security;
grant select, insert, update, delete on table public.itinerary_activities to authenticated;
create policy "people on a trip use its activities" on public.itinerary_activities
  for all to authenticated
  using (public.day_on_my_trip(day_id))
  with check (public.day_on_my_trip(day_id));
