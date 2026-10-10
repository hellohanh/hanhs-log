-- Migration 0002 (the trip's city): people on a trip can save the city the
-- map opens on; a stranger can neither see nor change it.
-- Cast: owner A, stranger B, guest C (joined by link, no email).

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, destination, owner_id, invite_token)
values ('22222222-2222-2222-2222-222222222222', 'Saigon eats', 'Ho Chi Minh City',
        '00000000-0000-0000-0000-00000000000a', '88888888-8888-8888-8888-888888888888');
update trips set city_query = 'Ho Chi Minh City', city_lat = 10.7769, city_lng = 106.7009,
  city_north = 10.89, city_south = 10.67, city_east = 106.85, city_west = 106.55
  where id = '22222222-2222-2222-2222-222222222222';
select test.ok((select city_lat from trips where id = '22222222-2222-2222-2222-222222222222') = 10.7769,
  'the owner saves the trip''s city');

select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('88888888-8888-8888-8888-888888888888');
select test.ok((select city_query from trips where id = '22222222-2222-2222-2222-222222222222') = 'Ho Chi Minh City',
  'a guest who joined by link sees the saved city');
update trips set city_query = 'Hội An', city_lat = 15.8801 where id = '22222222-2222-2222-2222-222222222222';
select test.ok((select city_lat from trips where id = '22222222-2222-2222-2222-222222222222') = 15.8801,
  'a member can save a new city (e.g. after the Destination changes)');

select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible($$select city_lat from trips where id = '22222222-2222-2222-2222-222222222222'$$) = 0,
  'a stranger can''t see the trip''s city');
update trips set city_lat = 0 where id = '22222222-2222-2222-2222-222222222222';

select test.act_as(null);
select test.ok(test.visible($$select city_lat from trips$$) = 0, 'a signed-out visitor sees no trip cities');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok((select city_lat from trips where id = '22222222-2222-2222-2222-222222222222') = 15.8801,
  'the stranger''s change had no effect');
