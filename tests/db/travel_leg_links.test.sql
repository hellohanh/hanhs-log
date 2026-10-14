-- Migration 0012 (travel legs linked to another trip).
-- Cast: A owns Saigon + Tokyo trips; B is on Tokyo only (invited); C a stranger.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'friend@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@test.local', false);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, start_date, end_date, invite_token) values
  ('11111111-1111-1111-1111-111111111111', 'Saigon', 'Vietnam', 'Hồ Chí Minh City', '2026-12-17', '2026-12-22', '11111111-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', 'Tokyo layover', 'Japan', 'Tokyo', '2026-12-19', '2026-12-20', '22222222-0000-0000-0000-000000000002');
insert into itinerary_days (id, trip_id, date) values
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-12-20');
insert into travel_legs (id, day_id, mode, title, carrier, reference, from_location, from_date, from_time, to_location, to_date, to_time)
values ('1e900000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'flight', 'Last leg', 'JAL', 'JL79',
        'Tokyo / HND', '2026-12-20', '01:25', 'Ho Chi Minh City / SGN', '2026-12-20', '05:55');
-- B joins the Tokyo trip only.
reset role;
insert into trip_members (trip_id, user_id) values ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000b');

-- ===== B (Tokyo only) can't link the Saigon leg, and doesn't see it yet =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from travel_legs') = 0, 'before linking, the Tokyo-only friend sees no Saigon leg');
select test.refused($$select link_travel_leg('1e900000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222')$$,
  'someone not on the leg''s trip can''t link it');

-- ===== A links it to Tokyo: the Dec 20 day is added there =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.refused($$select link_travel_leg('1e900000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111')$$,
  'a leg can''t be linked to its own trip');
select link_travel_leg('1e900000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
select test.ok((select count(*) from itinerary_days where trip_id = '22222222-2222-2222-2222-222222222222' and date = '2026-12-20') = 1,
  'linking adds the departure day to the other trip');
select link_travel_leg('1e900000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
select test.ok(test.visible('select * from travel_leg_links') = 1, 'linking twice keeps one link');
select test.ok((select count(*) from trip_leg_links('11111111-1111-1111-1111-111111111111') where direction = 'out' and other_trip_name = 'Tokyo layover') = 1,
  'the Saigon itinerary knows the leg also shows on Tokyo');

-- ===== B sees the linked leg but can't change it =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from travel_legs') = 1, 'the Tokyo-only friend now sees the linked leg');
select test.ok((select count(*) from trip_leg_links('22222222-2222-2222-2222-222222222222') where direction = 'in' and other_trip_name = 'Saigon') = 1,
  'the Tokyo itinerary knows where the leg comes from');
update travel_legs set title = 'Hacked' where id = '1e900000-0000-0000-0000-000000000001';
delete from travel_legs where id = '1e900000-0000-0000-0000-000000000001';
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok((select title from travel_legs where id = '1e900000-0000-0000-0000-000000000001') = 'Last leg',
  'the friend on the linked trip can''t edit or delete the leg');
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok((select count(*) from trip_leg_links('11111111-1111-1111-1111-111111111111')) = 0,
  'the friend can''t read the Saigon trip''s links');

-- ===== Stranger =====
select test.act_as('00000000-0000-0000-0000-00000000000c');
select test.ok(test.visible('select * from travel_legs') = 0, 'a stranger sees no legs');
select test.ok(test.visible('select * from travel_leg_links') = 0, 'a stranger sees no links');
select test.refused($$select link_travel_leg('1e900000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222')$$,
  'a stranger can''t link');

-- ===== Deleting the leg removes it everywhere =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
delete from travel_legs where id = '1e900000-0000-0000-0000-000000000001';
select test.ok(test.visible('select * from travel_leg_links') = 0, 'deleting the leg removes its links (gone from every trip)');
