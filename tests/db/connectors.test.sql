-- Migration 0006 (connectors between a day's stops).
-- Cast: owner A, stranger B, guest C (joined by link, no email).

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, invite_token)
values ('cc000000-0000-0000-0000-000000000001', 'Conn Trip', 'Vietnam', 'Hồ Chí Minh City', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into itinerary_days (id, trip_id, date) values
  ('cd000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', '2026-12-19'),
  ('cd000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000001', '2026-12-20');
insert into pins (id, trip_id, name, lat, lng, category) values
  ('ca000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'Phở', 10.78, 106.69, 'food'),
  ('ca000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000001', 'Pagoda', 10.79, 106.70, 'attraction');
insert into itinerary_stops (id, day_id, pin_id, start_time, end_time) values
  ('cb000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', '08:00', '09:00'),
  ('cb000000-0000-0000-0000-000000000002', 'cd000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000002', '09:30', '10:30'),
  ('cb000000-0000-0000-0000-000000000003', 'cd000000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-000000000001', '08:00', '09:00');

insert into itinerary_connectors (id, day_id, from_stop_id, to_stop_id, mode)
values ('ce000000-0000-0000-0000-000000000001', 'cd000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000002', 'drive');
select test.ok(test.visible('select * from itinerary_connectors') = 1, 'the owner sets a connector mode');
select test.refused($$insert into itinerary_connectors (day_id, from_stop_id, to_stop_id, mode) values ('cd000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000002', 'teleport')$$,
  'a connector mode must be one of the four');
-- A stop from another day can't be joined to this day's connector.
select test.refused($$insert into itinerary_connectors (day_id, from_stop_id, to_stop_id, mode) values ('cd000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000003', 'walk')$$,
  'both of a connector''s stops must be on its day');
select test.refused($$insert into itinerary_connectors (day_id, from_stop_id, to_stop_id, mode) values ('cd000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'walk')$$,
  'a connector can''t join a stop to itself');

-- ===== Stranger and signed-out visitor =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from itinerary_connectors') = 0, 'a stranger sees no connectors');
select test.refused($$insert into itinerary_connectors (day_id, from_stop_id, to_stop_id, mode) values ('cd000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-000000000001', 'walk')$$,
  'a stranger can''t set a connector');
update itinerary_connectors set mode = 'walk';
delete from itinerary_connectors;
select test.act_as(null);
select test.ok(test.visible('select * from itinerary_connectors') = 0, 'a signed-out visitor sees no connectors');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok((select mode from itinerary_connectors) = 'drive', 'the stranger''s edit and delete had no effect');

-- ===== Guest who joined by link =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('cccccccc-cccc-cccc-cccc-cccccccccccc');
select test.ok(test.visible('select * from itinerary_connectors') = 1, 'a guest who joined sees the connector');
update itinerary_connectors set mode = 'walk' where id = 'ce000000-0000-0000-0000-000000000001';
select test.ok((select mode from itinerary_connectors) = 'walk', 'a guest can change a connector mode');

-- ===== Deleting a stop removes its connectors =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
delete from itinerary_stops where id = 'cb000000-0000-0000-0000-000000000002';
select test.ok(test.visible('select * from itinerary_connectors') = 0, 'removing a stop removes connectors that used it');
