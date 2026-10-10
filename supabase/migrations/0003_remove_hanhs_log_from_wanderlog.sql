-- Give Wanderlog's database back exactly as it was before Hanh's Log
-- (Hanh, session 4). Hanh's Log is moving to its own, new Supabase project
-- and will build its trips from scratch; live Wanderlog must not be touched.
--
-- This removes everything migrations 0001 and 0002 added to Wanderlog's
-- database, and nothing else:
--   from 0002: the seven city_* columns on trips (and the city details the
--              new map saved on the trips Hanh opened on 10 Oct 2026);
--   from 0001: the owner/invite guard on trips, the four people functions,
--              trip_members.joined_at, and the profiles table (first names
--              typed in Hanh's Log only; old Wanderlog never used it).
-- Wanderlog's own trips, members, pins, days, stops, notes and flights are
-- not changed. Hanh's Log's bookkeeping schema (hanhs_log_meta, the list of
-- migrations that ran) stays so the record of this change is kept.
--
-- allow-destructive: Hanh approved removing Hanh's Log's own additions from Wanderlog's database (session 4); a backup is taken first by the migrations workflow, and no Wanderlog data is removed.

-- From 0002 -------------------------------------------------------------------
alter table public.trips
  drop column if exists city_query,
  drop column if exists city_lat,
  drop column if exists city_lng,
  drop column if exists city_north,
  drop column if exists city_south,
  drop column if exists city_east,
  drop column if exists city_west;

-- From 0001 -------------------------------------------------------------------
drop trigger if exists guard_trip_owner_fields on public.trips;
drop function if exists public.guard_trip_owner_fields();
drop function if exists public.trip_people(uuid);
drop function if exists public.trip_people_counts();
drop function if exists public.remove_trip_member(uuid, uuid);
drop function if exists public.reset_trip_invite(uuid);
alter table public.trip_members drop column if exists joined_at;
drop table if exists public.profiles;
