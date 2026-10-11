-- Hanh's Log's own database, part 4: pins (Hanh, session 4, M3 step 4).
--
-- 1. pins: a place on a trip, found with the Google search box in the
--    Places panel. Category is picked by hand (category › sub › sub-sub, from
--    docs/pin-standard.md). Food and drink pins can carry a MICHELIN level
--    (mentioned, or 1–3 stars; Bib Gourmand places are "mentioned") with its
--    year, and the Street food / Fine dining badges.
-- 2. pin_reviews: each person's own WTG ("want to go") or VIS ("visited")
--    for a pin. VIS needs a verdict (revisit, second chance, don't go back)
--    and may have a 1–5 rating in half stars. The pin shows the most recent
--    VIS verdict anyone gave, otherwise WTG (decided Q3, session 4).
-- Everyone on a trip can see its pins and everyone's reviews and can add or
-- change pins; each person can only set their own review. Nobody else can
-- see any of it.

-- 1. pins ------------------------------------------------------------------------
create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  google_place_id text check (google_place_id is null or char_length(google_place_id) <= 300),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  address text check (address is null or char_length(address) <= 400),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  category text not null check (category in ('accommodation', 'airport', 'attraction', 'shopping', 'transport', 'food')),
  subcategory text check (subcategory is null or char_length(subcategory) <= 80),
  subsubcategory text check (subsubcategory is null or char_length(subsubcategory) <= 80),
  michelin text check (michelin in ('mentioned', '1', '2', '3')),
  michelin_year smallint check (michelin_year between 1900 and 2100),
  street_food boolean not null default false,
  fine_dining boolean not null default false,
  note text check (note is null or char_length(note) <= 4000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  -- MICHELIN and the badges are for food and drink only; a year needs a level.
  check (category = 'food' or (michelin is null and not street_food and not fine_dining)),
  check (michelin_year is null or michelin is not null)
);
create index if not exists pins_trip on public.pins (trip_id);
alter table public.pins enable row level security;
grant select, insert, update, delete on table public.pins to authenticated;
create policy "people on a trip use its pins" on public.pins
  for all to authenticated
  using (public.is_on_trip(trip_id))
  with check (public.is_on_trip(trip_id));

-- Is this pin on one of my trips? (Security definer so pin_reviews' rule can
-- ask without looping through pins' own rule.)
create or replace function public.pin_on_my_trip(_pin uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from pins p where p.id = _pin and public.is_on_trip(p.trip_id))
$$;
revoke all on function public.pin_on_my_trip(uuid) from public, anon;
grant execute on function public.pin_on_my_trip(uuid) to authenticated;

-- 2. pin_reviews -----------------------------------------------------------------
create table if not exists public.pin_reviews (
  pin_id uuid not null references public.pins (id) on delete cascade,
  user_id uuid not null default auth.uid(),
  status text not null check (status in ('wtg', 'vis')),
  verdict text check (verdict in ('revisit', 'second', 'no')),
  rating numeric(2, 1) check (rating between 1 and 5 and rating * 2 = trunc(rating * 2)),
  updated_at timestamptz not null default now(),
  primary key (pin_id, user_id),
  -- VIS needs a verdict; WTG has neither a verdict nor a rating.
  check ((status = 'vis') = (verdict is not null)),
  check (status = 'vis' or rating is null)
);
alter table public.pin_reviews enable row level security;
grant select, insert, update, delete on table public.pin_reviews to authenticated;
create policy "people on a trip see its reviews" on public.pin_reviews
  for select to authenticated
  using (public.pin_on_my_trip(pin_id));
create policy "people set their own review" on public.pin_reviews
  for insert to authenticated
  with check (user_id = auth.uid() and public.pin_on_my_trip(pin_id));
create policy "people change their own review" on public.pin_reviews
  for update to authenticated
  using (user_id = auth.uid() and public.pin_on_my_trip(pin_id))
  with check (user_id = auth.uid() and public.pin_on_my_trip(pin_id));
create policy "people clear their own review" on public.pin_reviews
  for delete to authenticated
  using (user_id = auth.uid() and public.pin_on_my_trip(pin_id));

-- "Most recent wins" needs a true time of the last change.
create or replace function public.pin_reviews_touch()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end
$$;
create trigger pin_reviews_touch before update on public.pin_reviews
  for each row execute function public.pin_reviews_touch();
