-- Migration 0002 (itinerary panel): days, day notes and travel legs.
-- Cast: owner A, stranger B, guest C (joined by link, no email).

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, start_date, end_date, invite_token)
values ('44444444-4444-4444-4444-444444444444', 'Holiday Trip', 'Vietnam', 'Hồ Chí Minh City', '2026-12-17', '2026-12-22',
        '66666666-6666-6666-6666-666666666666');
insert into itinerary_days (id, trip_id, date, note) values
  ('d0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', '2026-12-17', 'Land at SGN'),
  ('d0000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', null, null);
select test.ok(test.visible('select * from itinerary_days') = 2, 'the owner adds a dated and an undated day');
select test.refused($$insert into itinerary_days (trip_id, date) values ('44444444-4444-4444-4444-444444444444', '2026-12-17')$$,
  'a trip can''t have two days with the same date');
insert into travel_legs (day_id, mode, carrier, reference, from_location, from_date, from_time, from_timezone, to_location, to_date, to_time, to_timezone)
values ('d0000000-0000-0000-0000-000000000001', 'flight', 'Vietnam Airlines', 'VN 300', 'Tokyo / NRT', '2026-12-17', '09:30', 'Asia/Tokyo',
        'Ho Chi Minh City / SGN', '2026-12-17', '13:45', 'Asia/Ho_Chi_Minh');
select test.ok(test.visible('select * from travel_legs') = 1, 'the owner adds a flight');
select test.refused($$insert into travel_legs (day_id, mode, from_location, to_location) values ('d0000000-0000-0000-0000-000000000001', 'boat', 'A', 'B')$$,
  'only flight, train, bus or own transport');

-- ===== Stranger and signed-out visitor =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from itinerary_days') = 0, 'a stranger sees no days');
select test.ok(test.visible('select * from travel_legs') = 0, 'a stranger sees no travel legs');
select test.refused($$insert into itinerary_days (trip_id, date) values ('44444444-4444-4444-4444-444444444444', '2026-12-18')$$,
  'a stranger can''t add a day');
select test.refused($$insert into travel_legs (day_id, mode, from_location, to_location) values ('d0000000-0000-0000-0000-000000000001', 'bus', 'A', 'B')$$,
  'a stranger can''t add a travel leg');
update itinerary_days set note = 'Hacked' where id = 'd0000000-0000-0000-0000-000000000001';
delete from travel_legs;

select test.act_as(null);
select test.ok(test.visible('select * from itinerary_days') = 0, 'a signed-out visitor sees no days');
select test.ok(test.visible('select * from travel_legs') = 0, 'a signed-out visitor sees no travel legs');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok((select note from itinerary_days where id = 'd0000000-0000-0000-0000-000000000001') = 'Land at SGN',
  'the stranger''s edit had no effect');
select test.ok(test.visible('select * from travel_legs') = 1, 'the stranger''s delete had no effect');

-- ===== Guest who joined by link =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('66666666-6666-6666-6666-666666666666');
select test.ok(test.visible('select * from itinerary_days') = 2, 'a guest who joined sees the days');
update itinerary_days set note = 'Land at SGN, Grab to hotel' where id = 'd0000000-0000-0000-0000-000000000001';
select test.ok((select note from itinerary_days where id = 'd0000000-0000-0000-0000-000000000001') = 'Land at SGN, Grab to hotel',
  'a guest can edit a day note');
insert into travel_legs (day_id, mode, from_location, to_location, from_time, to_time)
values ('d0000000-0000-0000-0000-000000000002', 'bus', 'Bến Thành', 'Vũng Tàu', '08:00', '10:30');
select test.ok(test.visible('select * from travel_legs') = 2, 'a guest can add a travel leg');
select test.refused($$insert into itinerary_days (trip_id) values ('00000000-0000-0000-0000-0000000000ff')$$,
  'nobody can add a day to a trip they''re not on');

-- ===== Deleting =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
delete from itinerary_days where id = 'd0000000-0000-0000-0000-000000000002';
select test.ok(test.visible('select * from travel_legs') = 1, 'deleting a day removes its travel legs');
delete from trips where id = '44444444-4444-4444-4444-444444444444';
select test.ok(test.visible('select * from itinerary_days') = 0, 'deleting the trip removes its days');
