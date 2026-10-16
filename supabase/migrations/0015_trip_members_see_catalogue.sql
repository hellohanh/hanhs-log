-- Hanh's Log's own database, part 15: everyone on a trip sees the whole
-- Savorlog catalogue (session 13, E101). Until now a co-traveler outside the
-- family circle saw (and could add, edit or queue for removal) only the
-- eateries within 20 km of their trips' cities (0007). Hanh decided:
--   * anyone on ANY trip (past or upcoming, link guests included) sees the
--     whole catalogue, with full add / edit / queue-for-removal rights and
--     everyone's WTG / VIS (finalizing a removal stays owner-only);
--   * a trip's map shows every catalogue eatery (trip_eateries no longer
--     limits to 20 km; the app filters to what's on screen);
--   * any eatery you can see can be put on an itinerary day (the 20 km rule
--     from 0010 is dropped).
-- The family circle itself (its member list, invite link) stays family-only.
-- Every rule that called near_my_trip() follows automatically: eateries'
-- select / insert / update policies, eatery_visible() (reviews, photos) and
-- request_eatery_deletion(). The coordinates are kept as arguments so those
-- callers don't change.

-- 1. "Near one of my trips" becomes "on any trip". -----------------------------
create or replace function public.on_any_trip()
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from trips t where t.owner_id = auth.uid())
    or exists (select 1 from trip_members m where m.user_id = auth.uid()))
$$;
revoke all on function public.on_any_trip() from public, anon;
grant execute on function public.on_any_trip() to authenticated;

create or replace function public.near_my_trip(_lat double precision, _lng double precision)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.on_any_trip()
$$;

-- 2. A trip's map: every live eatery, for anyone on the trip. ------------------
create or replace function public.trip_eateries(_trip uuid)
returns setof public.eateries
language sql stable security definer set search_path = public as $$
  select e.* from eateries e
  where public.is_on_trip(_trip) and e.deleted_at is null
$$;

-- 3. Any eatery you can see can go on a day (replaces 0010's 20 km check). -----
-- Not security definer: the lookup runs as the person scheduling, so an
-- eatery they can't see (row-level security) is refused.
create or replace function public.stop_pin_matches_day()
returns trigger
language plpgsql set search_path = public as $$
declare _t public.trips%rowtype;
begin
  select * into _t from trips where id = (select d.trip_id from itinerary_days d where d.id = new.day_id);
  if new.pin_id is not null then
    if _t.id is distinct from (select p.trip_id from pins p where p.id = new.pin_id) then
      raise exception 'A stop''s pin and day must be on the same trip.';
    end if;
  else
    if not exists (select 1 from eateries e where e.id = new.eatery_id and e.deleted_at is null) then
      raise exception 'That eatery isn''t in the catalogue.';
    end if;
  end if;
  return new;
end
$$;
