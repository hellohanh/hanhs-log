-- Milestone 3, step 2: who is on a trip (approved by Hanh, session 2).
--
-- 1. profiles: each person's first name, typed once (asked when they join a
--    trip). Nobody sees anyone's email; people on a trip see each other's
--    first names only through trip_people() below.
-- 2. trip_members.joined_at: when someone joined (empty for people who
--    joined before this migration).
-- 3. trip_people(trip): the people on a trip (owner + members), for anyone
--    on that trip. trip_people_counts(): how many people on each of your trips.
-- 4. remove_trip_member(trip, person): owner only.
-- 5. reset_trip_invite(trip): owner only; old invite links stop working.
-- 6. A guard on trips: only the owner may change the invite link, and the
--    owner of a trip can never be changed from the app. (Until now any
--    member could change both through the "trip members can edit trips"
--    rule.) Wanderlog's own trip edit only changes name, destination and
--    dates, so it is unaffected.
--
-- allow-destructive: remove_trip_member deletes one membership row when the trip's owner removes someone (feature approved by Hanh, session 2); nothing else is removed.

-- 1. profiles ---------------------------------------------------------------
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

-- 2. joined_at --------------------------------------------------------------
alter table public.trip_members add column if not exists joined_at timestamptz;
alter table public.trip_members alter column joined_at set default now();

-- 3. who is on a trip -------------------------------------------------------
create or replace function public.trip_people(_trip uuid)
returns table (user_id uuid, display_name text, is_owner boolean, is_me boolean, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  _owner uuid;
begin
  select t.owner_id into _owner from trips t where t.id = _trip;
  if not found or auth.uid() is null or not (
       _owner = auth.uid()
       or exists (select 1 from trip_members m where m.trip_id = _trip and m.user_id = auth.uid())) then
    raise exception 'not allowed: you are not on this trip';
  end if;

  return query
    select p.uid, pr.display_name, p.uid = _owner, p.uid = auth.uid(), p.joined
    from (
      select _owner as uid, null::timestamptz as joined where _owner is not null
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
         (case when t.owner_id is null then 0 else 1 end
          + (select count(*) from trip_members m where m.trip_id = t.id and m.user_id is distinct from t.owner_id))::integer
  from trips t
  where auth.uid() is not null and (
        t.owner_id = auth.uid()
        or exists (select 1 from trip_members m where m.trip_id = t.id and m.user_id = auth.uid()))
$$;

-- 4. owner removes someone --------------------------------------------------
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

-- 5. owner resets the invite link -------------------------------------------
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

-- 6. guard on trips -----------------------------------------------------------
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

-- Who may call the functions: signed-in people only (the functions check
-- the rest themselves). The trigger function is not callable directly.
revoke all on function public.trip_people(uuid) from public, anon;
revoke all on function public.trip_people_counts() from public, anon;
revoke all on function public.remove_trip_member(uuid, uuid) from public, anon;
revoke all on function public.reset_trip_invite(uuid) from public, anon;
revoke all on function public.guard_trip_owner_fields() from public, anon, authenticated;
grant execute on function public.trip_people(uuid) to authenticated;
grant execute on function public.trip_people_counts() to authenticated;
grant execute on function public.remove_trip_member(uuid, uuid) to authenticated;
grant execute on function public.reset_trip_invite(uuid) to authenticated;
