-- Hanh's Log's own database, part 7: the shared eatery catalogue (Savorlog,
-- M4 step 4b).
--
-- An eatery is a Nom-Nom food place, filed cuisine-country → main dish (the
-- same two levels a food pin uses). Unlike pins it belongs to NO trip: there
-- is ONE shared catalogue, held by everyone in the single Savorlog circle, and
-- it is browsed whole in Savorlog. A trip's map shows the catalogue eateries
-- within 20 km of any of that trip's cities, so every trip to an area shows
-- the same eateries and an eatery added anywhere shows up everywhere at once.
-- Each person keeps their own WTG/VIS verdict + half-star rating.
--
-- Who can do what: everyone in the circle sees & edits the whole catalogue;
-- trip co-travelers see (and may edit) the eateries within their trip's cities.
-- Deleting is two-stage: anyone who can see an eatery can send it to the
-- pending-deletion queue (hidden at once from everyone but the owner); only the
-- owner finalizes — confirm (permanent) or restore — on their next sign-in.
--
-- allow-destructive: finalize_eatery_deletion permanently removes one eatery
-- the owner has confirmed from the pending-deletion queue (the two-stage delete
-- Hanh approved, session 6); nothing else is removed.

-- 0. trip city coordinates -------------------------------------------------------
-- The Primary City already has map_lat/map_lng (0001). Secondary and Tertiary
-- were names only; give them coordinates too, so all three 20 km radii work
-- (the trip form fills them exactly as it fills the Primary City's).
alter table public.trips add column if not exists city_secondary_lat double precision;
alter table public.trips add column if not exists city_secondary_lng double precision;
alter table public.trips add column if not exists city_tertiary_lat double precision;
alter table public.trips add column if not exists city_tertiary_lng double precision;

-- 1. the one Savorlog circle -----------------------------------------------------
-- A single household circle. The first signed-in (non-anonymous) person to
-- claim it becomes the owner; family join later by the Savorlog invite (4e).
create table if not exists public.savorlog_members (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now()
);
alter table public.savorlog_members enable row level security;
grant select on table public.savorlog_members to authenticated;

-- Am I in the circle? (Security definer so the rules below don't loop through
-- this table's own rule.)
create or replace function public.in_savorlog(_uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select _uid is not null and exists (select 1 from savorlog_members m where m.user_id = _uid)
$$;
revoke all on function public.in_savorlog(uuid) from public, anon;
grant execute on function public.in_savorlog(uuid) to authenticated;

create or replace function public.is_savorlog_owner(_uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select _uid is not null and exists (select 1 from savorlog_members m where m.user_id = _uid and m.role = 'owner')
$$;
revoke all on function public.is_savorlog_owner(uuid) from public, anon;
grant execute on function public.is_savorlog_owner(uuid) to authenticated;

create policy "the circle sees its members" on public.savorlog_members
  for select to authenticated
  using (user_id = auth.uid() or public.in_savorlog(auth.uid()));

-- Claim the empty circle as its owner (first real user only; never a guest).
create or replace function public.claim_savorlog()
returns text
language plpgsql security definer set search_path = public as $$
declare
  _anon boolean := coalesce((current_setting('request.jwt.claims', true)::json ->> 'is_anonymous')::boolean, false);
begin
  if auth.uid() is null or _anon then
    raise exception 'not allowed: sign in first';
  end if;
  if not exists (select 1 from savorlog_members) then
    insert into savorlog_members (user_id, role) values (auth.uid(), 'owner');
  end if;
  return (select role from savorlog_members where user_id = auth.uid());
end $$;
revoke all on function public.claim_savorlog() from public, anon;
grant execute on function public.claim_savorlog() to authenticated;

-- 2. distance + "near one of my trips" ------------------------------------------
-- Great-circle metres between two points (haversine; no PostGIS needed).
create or replace function public.dist_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- Is this point within 20 km of a city of a trip I'm on? (E12. Security
-- definer so an eatery's rule can ask without needing to read trips directly.)
create or replace function public.near_my_trip(_lat double precision, _lng double precision)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from trips t
    where public.is_on_trip(t.id) and (
      (t.map_lat is not null and public.dist_m(_lat, _lng, t.map_lat, t.map_lng) <= 20000)
      or (t.city_secondary_lat is not null and public.dist_m(_lat, _lng, t.city_secondary_lat, t.city_secondary_lng) <= 20000)
      or (t.city_tertiary_lat is not null and public.dist_m(_lat, _lng, t.city_tertiary_lat, t.city_tertiary_lng) <= 20000)
    )
  )
$$;
revoke all on function public.near_my_trip(double precision, double precision) from public, anon;
grant execute on function public.near_my_trip(double precision, double precision) to authenticated;

-- 3. eateries --------------------------------------------------------------------
create table if not exists public.eateries (
  id uuid primary key default gen_random_uuid(),
  google_place_id text check (google_place_id is null or char_length(google_place_id) <= 300),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  address text check (address is null or char_length(address) <= 400),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  -- cuisine = the food's country; dish = the main dish (docs/pin-standard.md).
  cuisine text check (cuisine is null or char_length(cuisine) <= 80),
  dish text check (dish is null or char_length(dish) <= 80),
  michelin text check (michelin in ('mentioned', '1', '2', '3')),
  michelin_year smallint check (michelin_year between 1900 and 2100),
  street_food boolean not null default false,
  fine_dining boolean not null default false,
  price smallint check (price between 1 and 4),      -- $–$$$$; scale confirmed at 4d
  note text check (note is null or char_length(note) <= 4000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  -- pending-deletion queue: set to hide everywhere until the owner finalizes.
  deleted_at timestamptz,
  deleted_by uuid,
  check (michelin_year is null or michelin is not null)
);
-- One row per real place (two NULL place-ids are allowed; a found place is one).
create unique index if not exists eateries_place on public.eateries (google_place_id) where google_place_id is not null;
alter table public.eateries enable row level security;
-- No DELETE grant: a permanent delete happens only through the owner's
-- finalize function, never a raw statement.
grant select, insert, update on table public.eateries to authenticated;

-- You see an eatery if you're in the circle or it's near one of your trips;
-- a queued (deleted) one is hidden from everyone but the owner.
create policy "the circle and trip co-travelers see eateries" on public.eateries
  for select to authenticated
  using (
    (public.in_savorlog(auth.uid()) or public.near_my_trip(lat, lng))
    and (deleted_at is null or public.is_savorlog_owner(auth.uid()))
  );
create policy "anyone who can see the area adds eateries" on public.eateries
  for insert to authenticated
  with check (
    deleted_at is null
    and (public.in_savorlog(auth.uid()) or public.near_my_trip(lat, lng))
  );
-- Ordinary edits only touch live rows; sending to the queue goes through
-- request_eatery_deletion, restoring through restore_eatery.
create policy "anyone who can see it edits a live eatery" on public.eateries
  for update to authenticated
  using (
    deleted_at is null
    and (public.in_savorlog(auth.uid()) or public.near_my_trip(lat, lng))
  )
  with check (
    deleted_at is null
    and (public.in_savorlog(auth.uid()) or public.near_my_trip(lat, lng))
  );

-- Can the current user see this eatery (same rule as the SELECT policy)?
create or replace function public.eatery_visible(_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from eateries e
    where e.id = _id
      and (public.in_savorlog(auth.uid()) or public.near_my_trip(e.lat, e.lng))
      and (e.deleted_at is null or public.is_savorlog_owner(auth.uid()))
  )
$$;
revoke all on function public.eatery_visible(uuid) from public, anon;
grant execute on function public.eatery_visible(uuid) to authenticated;

-- Stage one: anyone who can see a live eatery sends it to the queue.
create or replace function public.request_eatery_deletion(_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from eateries e
    where e.id = _id and e.deleted_at is null
      and (public.in_savorlog(auth.uid()) or public.near_my_trip(e.lat, e.lng))
  ) then
    raise exception 'not allowed: you can''t remove this eatery';
  end if;
  update eateries set deleted_at = now(), deleted_by = auth.uid() where id = _id;
end $$;
revoke all on function public.request_eatery_deletion(uuid) from public, anon;
grant execute on function public.request_eatery_deletion(uuid) to authenticated;

-- Stage two (owner only): restore a queued eatery…
create or replace function public.restore_eatery(_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_savorlog_owner(auth.uid()) then
    raise exception 'not allowed: only the owner finalizes deletions';
  end if;
  update eateries set deleted_at = null, deleted_by = null where id = _id;
end $$;
revoke all on function public.restore_eatery(uuid) from public, anon;
grant execute on function public.restore_eatery(uuid) to authenticated;

-- …or confirm it, removing it for good (its reviews cascade away).
create or replace function public.finalize_eatery_deletion(_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_savorlog_owner(auth.uid()) then
    raise exception 'not allowed: only the owner finalizes deletions';
  end if;
  delete from eateries where id = _id and deleted_at is not null;
end $$;
revoke all on function public.finalize_eatery_deletion(uuid) from public, anon;
grant execute on function public.finalize_eatery_deletion(uuid) to authenticated;

-- The eateries a trip's map shows: within 20 km of one of its cities, live
-- only. Anyone on the trip may call it (co-travelers included).
create or replace function public.trip_eateries(_trip uuid)
returns setof public.eateries
language sql stable security definer set search_path = public as $$
  select e.* from eateries e, trips t
  where t.id = _trip and public.is_on_trip(_trip) and e.deleted_at is null and (
    (t.map_lat is not null and public.dist_m(e.lat, e.lng, t.map_lat, t.map_lng) <= 20000)
    or (t.city_secondary_lat is not null and public.dist_m(e.lat, e.lng, t.city_secondary_lat, t.city_secondary_lng) <= 20000)
    or (t.city_tertiary_lat is not null and public.dist_m(e.lat, e.lng, t.city_tertiary_lat, t.city_tertiary_lng) <= 20000)
  )
$$;
revoke all on function public.trip_eateries(uuid) from public, anon;
grant execute on function public.trip_eateries(uuid) to authenticated;

-- 4. eatery_reviews --------------------------------------------------------------
-- Each person's own WTG / VIS for an eatery, exactly like pin_reviews.
create table if not exists public.eatery_reviews (
  eatery_id uuid not null references public.eateries (id) on delete cascade,
  user_id uuid not null default auth.uid(),
  status text not null check (status in ('wtg', 'vis')),
  verdict text check (verdict in ('revisit', 'second', 'no')),
  rating numeric(2, 1) check (rating between 1 and 5 and rating * 2 = trunc(rating * 2)),
  updated_at timestamptz not null default now(),
  primary key (eatery_id, user_id),
  check ((status = 'vis') = (verdict is not null)),
  check (status = 'vis' or rating is null)
);
alter table public.eatery_reviews enable row level security;
grant select, insert, update, delete on table public.eatery_reviews to authenticated;
create policy "people who see an eatery see its reviews" on public.eatery_reviews
  for select to authenticated
  using (public.eatery_visible(eatery_id));
create policy "people set their own eatery review" on public.eatery_reviews
  for insert to authenticated
  with check (user_id = auth.uid() and public.eatery_visible(eatery_id));
create policy "people change their own eatery review" on public.eatery_reviews
  for update to authenticated
  using (user_id = auth.uid() and public.eatery_visible(eatery_id))
  with check (user_id = auth.uid() and public.eatery_visible(eatery_id));
create policy "people clear their own eatery review" on public.eatery_reviews
  for delete to authenticated
  using (user_id = auth.uid() and public.eatery_visible(eatery_id));

create trigger eatery_reviews_touch before update on public.eatery_reviews
  for each row execute function public.pin_reviews_touch();
