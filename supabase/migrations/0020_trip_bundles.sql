-- Hanh's Log's own database, part 20: one invite link for several trips
-- (session 14). Hanh decided:
--   * on Your trips, pick trips you OWN and make one link; whoever opens it
--     joins all of them at once (trips they're already on are skipped);
--   * only signed-in people can join with it (no anonymous guests), like the
--     Savorlog family invite;
--   * the link covers the trips picked when it was made; each trip's own
--     invite link keeps working; the owner can stop a link later.

create table if not exists public.trip_bundles (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_ids uuid[] not null check (cardinality(trip_ids) between 1 and 50),
  created_at timestamptz not null default now(),
  stopped_at timestamptz
);
alter table public.trip_bundles enable row level security;
-- Made and stopped only through the functions below; the owner reads their own.
grant select on table public.trip_bundles to authenticated;
create policy "owners see their several-trips links" on public.trip_bundles
  for select to authenticated
  using (owner_id = auth.uid());

-- Make a link for trips you own. Returns its token.
create or replace function public.create_trip_bundle(_trips uuid[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _anon boolean := coalesce((current_setting('request.jwt.claims', true)::json ->> 'is_anonymous')::boolean, false);
  _ids uuid[] := array(select distinct unnest(_trips));
  _token uuid;
begin
  if auth.uid() is null or _anon then raise exception 'not allowed: sign in with an account first'; end if;
  if cardinality(_ids) = 0 then raise exception 'Pick at least one trip.'; end if;
  if exists (select 1 from unnest(_ids) x(id) where not exists (select 1 from trips t where t.id = x.id and t.owner_id = auth.uid())) then
    raise exception 'not allowed: you can only include trips you own';
  end if;
  insert into trip_bundles (owner_id, trip_ids) values (auth.uid(), _ids) returning token into _token;
  return _token;
end $$;

-- Stop a link (owner only); it no longer works.
create or replace function public.stop_trip_bundle(_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update trip_bundles set stopped_at = coalesce(stopped_at, now()) where id = _id and owner_id = auth.uid();
  if not found then raise exception 'not allowed'; end if;
end $$;

-- What a link invites to (signed-in only): the trips still owned by its
-- maker, with the maker's first name. Nothing for a stopped or unknown link.
create or replace function public.trip_bundle_preview(_token uuid)
returns table (trip_id uuid, name text, start_date date, end_date date, from_name text, already boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  _anon boolean := coalesce((current_setting('request.jwt.claims', true)::json ->> 'is_anonymous')::boolean, false);
begin
  if auth.uid() is null or _anon then raise exception 'not allowed: sign in with an account first'; end if;
  return query
    select t.id, t.name, t.start_date, t.end_date, p.display_name,
           (t.owner_id = auth.uid() or exists (select 1 from trip_members m where m.trip_id = t.id and m.user_id = auth.uid()))
    from trip_bundles b
    join trips t on t.id = any (b.trip_ids) and t.owner_id = b.owner_id
    left join profiles p on p.user_id = b.owner_id
    where b.token = _token and b.stopped_at is null
    order by t.start_date nulls last, t.name;
end $$;

-- Join every trip on the link (signed-in only). Returns how many were joined.
create or replace function public.join_trips_via_bundle(_token uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  _anon boolean := coalesce((current_setting('request.jwt.claims', true)::json ->> 'is_anonymous')::boolean, false);
  _b trip_bundles;
  _n int;
begin
  if auth.uid() is null or _anon then raise exception 'not allowed: sign in with an account first'; end if;
  select * into _b from trip_bundles where token = _token and stopped_at is null;
  if _b.id is null then raise exception 'invalid or stopped invite link'; end if;
  insert into trip_members (trip_id, user_id)
    select t.id, auth.uid() from trips t
    where t.id = any (_b.trip_ids) and t.owner_id = _b.owner_id and t.owner_id <> auth.uid()
  on conflict (trip_id, user_id) do nothing;
  get diagnostics _n = row_count;
  return _n;
end $$;

revoke all on function public.create_trip_bundle(uuid[]) from public, anon;
revoke all on function public.stop_trip_bundle(uuid) from public, anon;
revoke all on function public.trip_bundle_preview(uuid) from public, anon;
revoke all on function public.join_trips_via_bundle(uuid) from public, anon;
grant execute on function public.create_trip_bundle(uuid[]) to authenticated;
grant execute on function public.stop_trip_bundle(uuid) to authenticated;
grant execute on function public.trip_bundle_preview(uuid) to authenticated;
grant execute on function public.join_trips_via_bundle(uuid) to authenticated;
