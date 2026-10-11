-- Migration 0005 (places dropped onto itinerary days).
-- Cast: owner A, stranger B, guest C (joined by link, no email).

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, invite_token)
values ('99999999-9999-9999-9999-999999999999', 'Stops Trip', 'Vietnam', 'Hồ Chí Minh City', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into itinerary_days (id, trip_id, date) values
  ('d2000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', '2026-12-19');
insert into pins (id, trip_id, name, lat, lng, category, subcategory, subsubcategory)
values ('c1000000-0000-0000-0000-000000000001', '99999999-9999-9999-9999-999999999999', 'Phở Hòa Pasteur', 10.789, 106.689, 'food', 'vietnamese', 'pho');
insert into itinerary_stops (id, day_id, pin_id, start_time, end_time)
values ('e1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '08:00', '09:00');
select test.ok(test.visible('select * from itinerary_stops') = 1, 'the owner drops a place onto a day');
-- The same place can be on a day more than once.
insert into itinerary_stops (day_id, pin_id, start_time, end_time)
values ('d2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '18:00', '19:30');
select test.ok(test.visible('select * from itinerary_stops') = 2, 'the same place can be on a day twice');
select test.refused($$insert into itinerary_stops (day_id, pin_id, start_time, end_time) values ('d2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '09:00', '08:00')$$,
  'a stop can''t end before it starts');

-- A pin from another trip can't be scheduled onto this day.
insert into trips (id, name, country, city_primary, invite_token)
values ('99999999-9999-9999-9999-99999999aaaa', 'Other Trip', 'Japan', 'Tokyo', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into pins (id, trip_id, name, lat, lng, category)
values ('c1000000-0000-0000-0000-0000000000ff', '99999999-9999-9999-9999-99999999aaaa', 'Tsukiji', 35.66, 139.77, 'food');
select test.refused($$insert into itinerary_stops (day_id, pin_id, start_time, end_time) values ('d2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-0000000000ff', '10:00', '11:00')$$,
  'a stop''s pin and day must be on the same trip');

-- ===== Stranger and signed-out visitor =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from itinerary_stops') = 0, 'a stranger sees no stops');
select test.refused($$insert into itinerary_stops (day_id, pin_id, start_time, end_time) values ('d2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '12:00', '13:00')$$,
  'a stranger can''t drop a place onto a day');
update itinerary_stops set start_time = '00:00';
delete from itinerary_stops;
select test.act_as(null);
select test.ok(test.visible('select * from itinerary_stops') = 0, 'a signed-out visitor sees no stops');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok((select start_time from itinerary_stops where id = 'e1000000-0000-0000-0000-000000000001') = '08:00', 'the stranger''s edit and delete had no effect');

-- ===== Guest who joined by link =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select test.ok(test.visible('select * from itinerary_stops') = 2, 'a guest who joined sees the stops');
update itinerary_stops set start_time = '08:15', end_time = '09:30' where id = 'e1000000-0000-0000-0000-000000000001';
select test.ok((select end_time from itinerary_stops where id = 'e1000000-0000-0000-0000-000000000001') = '09:30', 'a guest can move or resize a stop');

-- ===== Deleting the day and the pin =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
delete from pins where id = 'c1000000-0000-0000-0000-000000000001';
select test.ok(test.visible('select * from itinerary_stops') = 0, 'removing a pin removes its stops');
insert into pins (id, trip_id, name, lat, lng, category)
values ('c1000000-0000-0000-0000-000000000002', '99999999-9999-9999-9999-999999999999', 'Anan', 10.77, 106.70, 'food');
insert into itinerary_stops (day_id, pin_id, start_time, end_time)
values ('d2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', '12:00', '13:00');
delete from itinerary_days where id = 'd2000000-0000-0000-0000-000000000001';
select test.ok(test.visible('select * from itinerary_stops') = 0, 'deleting a day removes its stops');
