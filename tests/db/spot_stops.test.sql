-- Migration 0022 (an itinerary stop can be a Roaminglog spot). A owns a trip
-- and the circle; C joined the trip by link (anonymous); B is a stranger.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

select test.act_as('00000000-0000-0000-0000-00000000000a');
select claim_savorlog();
insert into trips (id, name, country, city_primary, invite_token)
values ('66666666-6666-6666-6666-666666666666', 'Saigon', 'Vietnam', 'Hồ Chí Minh City', '88888888-8888-8888-8888-888888888888');
insert into itinerary_days (id, trip_id, date) values ('d0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', '2026-12-20');
insert into spots (id, google_place_id, name, lat, lng, category) values
  ('51000000-0000-0000-0000-000000000001', 'g-ben-thanh', 'Bến Thành Market', 10.772, 106.698, 'shopping'),
  ('52000000-0000-0000-0000-000000000002', 'g-meiji', 'Meiji Shrine', 35.676, 139.699, 'attraction');

insert into itinerary_stops (day_id, spot_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '09:00', '10:00');
select test.ok(test.visible('select * from itinerary_stops where spot_id is not null') = 1, 'a spot can be scheduled on a day');
insert into itinerary_stops (day_id, spot_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '11:00', '12:00');
select test.ok(test.visible('select * from itinerary_stops') = 2, 'a far spot can be scheduled too (spots are on every trip)');
select test.refused($$insert into itinerary_stops (day_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', '13:00', '14:00')$$,
  'a stop must point at something');
insert into eateries (id, name, lat, lng, cuisine) values ('e1000000-0000-0000-0000-000000000001', 'Phở Hòa', 10.789, 106.689, 'vietnamese');
select test.refused($$insert into itinerary_stops (day_id, spot_id, eatery_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', '13:00', '14:00')$$,
  'a stop can''t be both a spot and an eatery');
select test.refused($$insert into itinerary_stops (day_id, spot_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', '5f000000-0000-0000-0000-00000000000f', '13:00', '14:00')$$,
  'a stop can''t point at a spot that doesn''t exist');

-- C, the guest on the trip, sees the stops and can schedule a spot.
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('88888888-8888-8888-8888-888888888888');
select test.ok(test.visible('select * from itinerary_stops') = 2, 'an invited guest sees the spot stops');
insert into itinerary_stops (day_id, spot_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '15:00', '16:00');
select test.ok(test.visible('select * from itinerary_stops') = 3, 'an invited guest can schedule a spot');

-- B, the stranger, sees none of it.
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from itinerary_stops') = 0, 'a stranger sees no stops');
select test.refused($$insert into itinerary_stops (day_id, spot_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', '17:00', '18:00')$$,
  'a stranger can''t schedule on the trip');

-- A spot waiting for removal can't be scheduled; finalizing clears its stops.
select test.act_as('00000000-0000-0000-0000-00000000000a');
select request_spot_deletion('52000000-0000-0000-0000-000000000002');
select test.refused($$insert into itinerary_stops (day_id, spot_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000002', '19:00', '20:00')$$,
  'a spot waiting for removal can''t be scheduled');
select finalize_spot_deletion('52000000-0000-0000-0000-000000000002');
select test.ok(test.visible('select * from itinerary_stops') = 1, 'removing a spot for good clears its stops');
