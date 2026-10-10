-- Migration 0003: Wanderlog's database is back to how it was before
-- Hanh's Log. Nothing Hanh's Log added is left, and Wanderlog's own
-- sharing still works (trip_sharing.test.sql covers that in full).

select test.ok(not exists (select 1 from information_schema.columns
                           where table_schema = 'public' and table_name = 'trips' and column_name like 'city\_%'),
  'the city columns are gone from trips');
select test.ok(not exists (select 1 from information_schema.columns
                           where table_schema = 'public' and table_name = 'trip_members' and column_name = 'joined_at'),
  'trip_members has no joined_at column');
select test.ok(to_regclass('public.profiles') is null, 'the profiles table is gone');
select test.ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                           where n.nspname = 'public'
                             and p.proname in ('trip_people', 'trip_people_counts', 'remove_trip_member', 'reset_trip_invite', 'guard_trip_owner_fields')),
  'the people functions and the owner/invite guard are gone');
select test.ok(not exists (select 1 from pg_trigger where tgname = 'guard_trip_owner_fields'),
  'no guard trigger is left on trips');

-- Wanderlog's own behaviour is untouched: a member can still edit a trip as before.
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000d', 'member@test.local', false);
select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, destination, owner_id, invite_token)
values ('33333333-3333-3333-3333-333333333333', 'Old trip', 'Rome', '00000000-0000-0000-0000-00000000000a',
        '77777777-7777-7777-7777-777777777777');
select test.act_as('00000000-0000-0000-0000-00000000000d');
select join_trip_via_invite('77777777-7777-7777-7777-777777777777');
update trips set name = 'Old trip, renamed' where id = '33333333-3333-3333-3333-333333333333';
select test.ok((select name from trips where id = '33333333-3333-3333-3333-333333333333') = 'Old trip, renamed',
  'a Wanderlog member can still edit the trip, as before Hanh''s Log');
