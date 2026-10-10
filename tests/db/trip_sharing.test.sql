-- Who can see and change a trip: the owner, a stranger, an invited guest
-- (signed in anonymously through the invite link, like family members do),
-- and a visitor who isn't signed in at all.
-- This is the test that would have caught Wanderlog's missing trip_members
-- policy (L34), which kept sharing broken for months while the owner's own
-- view looked fine.

-- The cast of people (created directly, as Supabase's login service would).
insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

-- ===== Owner builds a trip =====
select test.act_as('00000000-0000-0000-0000-00000000000a');

insert into trips (id, name, destination, owner_id, invite_token)
values ('11111111-1111-1111-1111-111111111111', 'Tokyo test', 'Tokyo',
        '00000000-0000-0000-0000-00000000000a', '99999999-9999-9999-9999-999999999999');
insert into pins (id, trip_id, name, category, lat, lng, added_by)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
        'Busta Shinjuku', 'attraction', 35.69, 139.70, '00000000-0000-0000-0000-00000000000a');
insert into itinerary_days (id, trip_id, day_number, date)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 1, '2026-12-18');
insert into itinerary_stops (itinerary_day_id, pin_id, order_index, start_time, end_time, notes)
values ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 0, '08:15', '09:45', 'drop bags');
insert into travel_legs (itinerary_day_id, mode, from_location, to_location, order_index)
values ('33333333-3333-3333-3333-333333333333', 'flight', 'Los Angeles / LAX', 'Tokyo / HND', 0);

select test.ok(test.visible('select * from trips') = 1, 'owner sees their trip');
select test.ok(test.visible('select * from pins') = 1, 'owner sees their pin');
select test.ok(test.visible('select * from itinerary_days') = 1, 'owner sees their day');
select test.ok(test.visible('select * from itinerary_stops') = 1, 'owner sees their stop');
select test.ok(test.visible('select * from travel_legs') = 1, 'owner sees their flight');

-- ===== A stranger (signed in, never invited) =====
select test.act_as('00000000-0000-0000-0000-00000000000b');

select test.ok(test.visible('select * from trips') = 0, 'stranger cannot see the trip');
select test.ok(test.visible('select * from pins') = 0, 'stranger cannot see pins');
select test.ok(test.visible('select * from itinerary_days') = 0, 'stranger cannot see days');
select test.ok(test.visible('select * from itinerary_stops') = 0, 'stranger cannot see stops');
select test.ok(test.visible('select * from travel_legs') = 0, 'stranger cannot see flights');
select test.ok(test.visible('select * from trip_members') = 0, 'stranger cannot see who is on the trip');
select test.refused($$insert into pins (trip_id, name, category, lat, lng)
  values ('11111111-1111-1111-1111-111111111111', 'sneaky pin', 'dining', 0, 0)$$,
  'stranger cannot add a pin to the trip');
select test.refused($$insert into trip_members (trip_id, user_id)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b')$$,
  'stranger cannot add themselves as a member directly');
select test.refused($$select join_trip_via_invite('88888888-8888-8888-8888-888888888888')$$,
  'a wrong invite code is refused');
-- Updates/deletes on rows you can't see silently touch nothing; check by count.
update trips set name = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
delete from pins where id = '22222222-2222-2222-2222-222222222222';
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok((select name from trips where id = '11111111-1111-1111-1111-111111111111') = 'Tokyo test',
  'stranger''s edit to the trip had no effect');
select test.ok(test.visible('select * from pins') = 1, 'stranger''s delete of a pin had no effect');

-- ===== An invited guest, signed in anonymously through the invite link =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);

select test.ok(test.visible('select * from trips') = 0, 'guest sees nothing before joining');
select test.ok(
  (select join_trip_via_invite('99999999-9999-9999-9999-999999999999')) = '11111111-1111-1111-1111-111111111111',
  'guest joins with the invite code');
select test.ok(test.visible('select * from trips') = 1, 'guest sees the trip after joining (L34)');
select test.ok(test.visible('select * from pins') = 1, 'guest sees the pins');
select test.ok(test.visible('select * from itinerary_days') = 1, 'guest sees the days');
select test.ok(test.visible('select * from itinerary_stops') = 1, 'guest sees the stops');
select test.ok(test.visible('select * from travel_legs') = 1, 'guest sees the flights');
insert into pins (trip_id, name, category, lat, lng, added_by)
values ('11111111-1111-1111-1111-111111111111', 'Ichiran', 'dining', 35.69, 139.70, '00000000-0000-0000-0000-00000000000c');
select test.ok(test.visible('select * from pins') = 2, 'guest can add a pin');
select test.ok(
  (select join_trip_via_invite('99999999-9999-9999-9999-999999999999')) = '11111111-1111-1111-1111-111111111111',
  'joining twice is harmless');
delete from trips where id = '11111111-1111-1111-1111-111111111111';
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok(test.visible('select * from trips') = 1, 'guest cannot delete the trip (owner only)');
select test.ok(test.visible('select * from pins') = 2, 'owner sees the guest''s pin');

-- ===== Still nothing for the stranger after the guest joined =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from trips') = 0, 'stranger still sees nothing after a guest joins');
select test.ok(test.visible('select * from pins') = 0, 'stranger still sees no pins');

-- ===== A visitor who isn't signed in at all =====
select test.act_as(null);
select test.ok(test.visible('select * from trips') = 0, 'signed-out visitor sees no trips');
select test.ok(test.visible('select * from pins') = 0, 'signed-out visitor sees no pins');
select test.refused($$insert into trips (name, destination) values ('x', 'y')$$,
  'signed-out visitor cannot create a trip');
select test.refused($$select join_trip_via_invite('99999999-9999-9999-9999-999999999999')$$,
  'signed-out visitor cannot use an invite code without signing in');

-- ===== Owner can delete their own trip =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
delete from trips where id = '11111111-1111-1111-1111-111111111111';
select test.ok(test.visible('select * from trips') = 0, 'owner can delete their own trip');
