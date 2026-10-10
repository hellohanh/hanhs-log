-- Hanh's Log's own database, part 1: trips and the people on them
-- (Hanh, session 4). Hanh's Log now has its own Supabase project and builds
-- its trips from scratch; live Wanderlog's database is never touched.
--
-- 1. profiles: each person's first name (asked once; nobody sees emails).
-- 2. trips: name, Country, Primary / Secondary / Tertiary City (Country and
--    Primary required), optional dates, owner, invite link, and the place
--    the map opens on (looked up once from the Primary City and saved).
-- 3. trip_members: who joined a trip by invite link, and when.
-- 4. Who can see and change what (row-level security), via is_on_trip().
-- 5. Joining by link, the people list and counts, owner-only remove and
--    reset link, and a guard so a trip's owner can never change and only
--    the owner can change the invite link.
--
-- allow-destructive: remove_trip_member deletes one membership row when the trip's owner removes someone (feature approved by Hanh, session 2); nothing else is removed.

-- 0. Safety: never run this on the old Wanderlog database. -------------------
do $$
begin
  if to_regclass('public.itinerary_days') is not null or to_regclass('public.travel_legs') is not null then
    raise exception 'Stopped: this is the old Wanderlog database. Point SUPABASE_DB_URL at the new Hanh''s Log project first.';
  end if;
end $$;

-- 1. profiles -------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, insert, update on table public.profiles to authenticated;
create policy "people read their own profile" on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy "people create their own profile" on public.profiles
  for insert to authenticated with check (user_id = auth.uid());
create policy "people update their own profile" on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. trips ------------------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  country text not null check (char_length(btrim(country)) between 1 and 80),
  city_primary text not null check (char_length(btrim(city_primary)) between 1 and 80),
  city_secondary text check (city_secondary is null or char_length(btrim(city_secondary)) between 1 and 80),
  city_tertiary text check (city_tertiary is null or char_length(btrim(city_tertiary)) between 1 and 80),
  start_date date,
  end_date date,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  invite_token uuid not null unique default gen_random_uuid(),
  -- Where the map opens: the Primary City as Google found it.
  map_query text,   -- what was looked up, e.g. "Hồ Chí Minh City, Vietnam"
  map_label text,   -- what Google matched, e.g. "Thành phố Hồ Chí Minh, Vietnam"
  map_lat double precision,
  map_lng double precision,
  map_north double precision,
  map_south double precision,
  map_east double precision,
  map_west double precision,
  created_at timestamptz not null default now(),
  check (start_date is null or end_date is null or end_date >= start_date)
);
alter table public.trips enable row level security;
grant select, insert, update, delete on table public.trips to authenticated;

-- 3. trip_members -----------------------------------------------------------------
create table if not exists public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
alter table public.trip_members enable row level security;
grant select on table public.trip_members to authenticated;

-- 4. who can see and change what --------------------------------------------------
-- is_on_trip: the owner or a member. Security definer so the rules below
-- can ask without looping back through each other's rules.
create or replace function public.is_on_trip(_trip uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from trips t where t.id = _trip and t.owner_id = auth.uid())
    or exists (select 1 from trip_members m where m.trip_id = _trip and m.user_id = auth.uid()))
$$;

create policy "people on a trip see it" on public.trips
  for select to authenticated using (public.is_on_trip(id));
create policy "signed-in people create their own trips" on public.trips
  for insert to authenticated with check (owner_id = auth.uid());
create policy "people on a trip edit it" on public.trips
  for update to authenticated using (public.is_on_trip(id)) with check (public.is_on_trip(id));
create policy "only the owner deletes a trip" on public.trips
  for delete to authenticated using (owner_id = auth.uid());

create policy "people on a trip see who else is on it" on public.trip_members
  for select to authenticated using (user_id = auth.uid() or public.is_on_trip(trip_id));

-- 5. joining, people, owner actions, guard ---------------------------------------
create or replace function public.join_trip_via_invite(_token uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _trip uuid;
  _owner uuid;
begin
  if auth.uid() is null then
    raise exception 'not allowed: sign in first';
  end if;
  select t.id, t.owner_id into _trip, _owner from trips t where t.invite_token = _token;
  if _trip is null then
    raise exception 'invalid invite token';
  end if;
  if _owner is distinct from auth.uid() then
    insert into trip_members (trip_id, user_id) values (_trip, auth.uid())
    on conflict (trip_id, user_id) do nothing;
  end if;
  return _trip;
end $$;

create or replace function public.trip_people(_trip uuid)
returns table (user_id uuid, display_name text, is_owner boolean, is_me boolean, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  _owner uuid;
begin
  if not public.is_on_trip(_trip) then
    raise exception 'not allowed: you are not on this trip';
  end if;
  select t.owner_id into _owner from trips t where t.id = _trip;
  return query
    select p.uid, pr.display_name, p.uid = _owner, p.uid = auth.uid(), p.joined
    from (
      select _owner as uid, null::timestamptz as joined
      union all
      select m.user_id, m.joined_at from trip_members m
      where m.trip_id = _trip and m.user_id is distinct from _owner
    ) p
    left join profiles pr on pr.user_id = p.uid
    order by (p.uid = _owner) desc, p.joined nulls first, pr.display_name;
end $$;

create or replace function public.trip_people_counts()
returns table (trip_id uuid, people integer)
language sql stable security definer set search_path = public as $$
  select t.id,
         (1 + (select count(*) from trip_members m where m.trip_id = t.id and m.user_id is distinct from t.owner_id))::integer
  from trips t
  where public.is_on_trip(t.id)
$$;

create or replace function public.remove_trip_member(_trip uuid, _user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from trips t where t.id = _trip and t.owner_id = auth.uid()) then
    raise exception 'not allowed: only the trip''s owner can remove people';
  end if;
  if _user = auth.uid() then
    raise exception 'the owner cannot remove themselves';
  end if;
  delete from trip_members m where m.trip_id = _trip and m.user_id = _user;
end $$;

create or replace function public.reset_trip_invite(_trip uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _token uuid;
begin
  if auth.uid() is null or not exists (select 1 from trips t where t.id = _trip and t.owner_id = auth.uid()) then
    raise exception 'not allowed: only the trip''s owner can reset the invite link';
  end if;
  update trips set invite_token = gen_random_uuid() where id = _trip returning invite_token into _token;
  return _token;
end $$;

-- auth.uid() is empty for maintenance run by Hanh's own workflows, which are
-- left alone; app users are checked.
create or replace function public.guard_trip_owner_fields()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'not allowed: a trip''s owner cannot be changed';
    end if;
    if new.invite_token is distinct from old.invite_token and old.owner_id is distinct from auth.uid() then
      raise exception 'not allowed: only the trip''s owner can change the invite link';
    end if;
  end if;
  return new;
end $$;

create trigger guard_trip_owner_fields
  before update on public.trips
  for each row execute function public.guard_trip_owner_fields();

revoke all on function public.is_on_trip(uuid) from public, anon;
revoke all on function public.join_trip_via_invite(uuid) from public, anon;
revoke all on function public.trip_people(uuid) from public, anon;
revoke all on function public.trip_people_counts() from public, anon;
revoke all on function public.remove_trip_member(uuid, uuid) from public, anon;
revoke all on function public.reset_trip_invite(uuid) from public, anon;
revoke all on function public.guard_trip_owner_fields() from public, anon, authenticated;
grant execute on function public.is_on_trip(uuid) to authenticated;
grant execute on function public.join_trip_via_invite(uuid) to authenticated;
grant execute on function public.trip_people(uuid) to authenticated;
grant execute on function public.trip_people_counts() to authenticated;
grant execute on function public.remove_trip_member(uuid, uuid) to authenticated;
grant execute on function public.reset_trip_invite(uuid) to authenticated;
