-- Migration 0023 (when each shared row last changed, and by whom).
-- A owns a trip; F joined it by invite; B is a stranger.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000f', 'friend@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, invite_token)
values ('66666666-6666-6666-6666-666666666666', 'Saigon', 'Vietnam', 'Hồ Chí Minh City', '88888888-8888-8888-8888-888888888888');
insert into itinerary_days (id, trip_id, date) values ('d0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', '2026-12-20');
insert into itinerary_activities (id, day_id, title, start_time, end_time, updated_by, updated_at)
values ('a1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Cooking class', '15:00', '16:00', '00000000-0000-0000-0000-00000000000b', '2000-01-01');
select test.ok((select updated_by from itinerary_activities) = '00000000-0000-0000-0000-00000000000a', 'a new row records who added it (it can''t be set by hand)');
select test.ok((select updated_at from itinerary_activities) > '2020-01-01', 'a new row records when (not a time sent by the app)');

-- F, on the trip, changes it: the row now says F, and a later time.
select test.act_as('00000000-0000-0000-0000-00000000000f');
select join_trip_via_invite('88888888-8888-8888-8888-888888888888');
reset role;
update itinerary_activities set updated_at = '2026-01-01';
select test.act_as('00000000-0000-0000-0000-00000000000f');
update itinerary_activities set note = 'Bring the voucher';
select test.ok((select updated_by from itinerary_activities) = '00000000-0000-0000-0000-00000000000f', 'an edit records who made it');
select test.ok((select updated_at from itinerary_activities) > '2026-01-02', 'an edit records when');
select test.ok(test.visible('select updated_at, updated_by from itinerary_activities') = 1, 'people on the trip can see when and by whom');
update itinerary_activities set updated_by = '00000000-0000-0000-0000-00000000000a';
select test.ok((select updated_by from itinerary_activities) = '00000000-0000-0000-0000-00000000000f', 'nobody can claim someone else made a change');

-- B, a stranger, still sees nothing.
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from itinerary_activities') = 0, 'a stranger still sees no rows');

-- Every shared table has the two columns.
reset role;
select test.ok((select count(*) from information_schema.columns where table_schema = 'public' and column_name in ('updated_at', 'updated_by')
  and table_name in ('trips', 'itinerary_days', 'travel_legs', 'itinerary_activities', 'itinerary_stops', 'pins', 'spots', 'eateries')) = 16,
  'trips, days, legs, activities, stops, pins, spots and eateries all record their last change');
