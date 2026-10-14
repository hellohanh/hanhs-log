-- Migration 0013 (repeat days for flights across the date line).
-- Cast: A owns the trip; B is on it (invited); C a stranger.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'friend@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@test.local', false);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, start_date, end_date, invite_token) values
  ('11111111-1111-1111-1111-111111111111', 'Homebound', 'South Korea', 'Seoul', '2027-01-02', '2027-01-04', '11111111-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', 'Seattle', 'United States', 'Seattle', '2027-01-03', '2027-01-05', '22222222-0000-0000-0000-000000000002');
insert into itinerary_days (id, trip_id, date) values
  ('d0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '2027-01-03');
reset role;
insert into trip_members (trip_id, user_id) values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000b');

-- ===== Jan 3 twice: an ordinary day and a repeat day =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
insert into itinerary_days (id, trip_id, date, repeat_after) values
  ('d0000000-0000-0000-0000-0000000000a3', '11111111-1111-1111-1111-111111111111', '2027-01-03', '2027-01-03');
select test.ok((select count(*) from itinerary_days where trip_id = '11111111-1111-1111-1111-111111111111' and date = '2027-01-03') = 2,
  'an invited member can add a repeat Jan 3 next to the ordinary one');
select test.refused($$insert into itinerary_days (trip_id, date) values ('11111111-1111-1111-1111-111111111111', '2027-01-03')$$,
  'still only one ordinary day per date');
select test.refused($$insert into itinerary_days (trip_id, date, repeat_after) values ('11111111-1111-1111-1111-111111111111', '2027-01-03', '2027-01-03')$$,
  'only one repeat day per date and departure date');
select test.refused($$insert into itinerary_days (trip_id, date, repeat_after) values ('11111111-1111-1111-1111-111111111111', null, '2027-01-03')$$,
  'a repeat day needs a date');

-- ===== Linking a leg uses the ordinary day, never the repeat =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into itinerary_days (id, trip_id, date) values
  ('d0000000-0000-0000-0000-000000000013', '22222222-2222-2222-2222-222222222222', '2027-01-03');
insert into itinerary_days (id, trip_id, date, repeat_after) values
  ('d0000000-0000-0000-0000-0000000001a3', '22222222-2222-2222-2222-222222222222', '2027-01-03', '2027-01-03');
insert into travel_legs (id, day_id, mode, title, from_location, from_date, from_time, from_timezone, to_location, to_date, to_time, to_timezone)
values ('1e900000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'flight', '2nd leg',
        'Seoul / ICN', '2027-01-03', '18:45', 'Asia/Seoul', 'Seattle / SEA', '2027-01-03', '12:00', 'America/Los_Angeles');
select test.ok(link_travel_leg('1e900000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222') = 'd0000000-0000-0000-0000-000000000013',
  'linking lands on the other trip''s ordinary Jan 3');

-- ===== Stranger =====
select test.act_as('00000000-0000-0000-0000-00000000000c');
select test.ok(test.visible('select * from itinerary_days') = 0, 'a stranger sees no days, repeat or not');
select test.refused($$insert into itinerary_days (trip_id, date, repeat_after) values ('11111111-1111-1111-1111-111111111111', '2027-01-04', '2027-01-04')$$,
  'a stranger can''t add a repeat day');
