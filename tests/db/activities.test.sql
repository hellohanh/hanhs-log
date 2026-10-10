-- Migration 0003 (activity blocks on the itinerary).
-- Cast: owner A, stranger B, guest C (joined by link, no email).

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, invite_token)
values ('55555555-5555-5555-5555-555555555555', 'Holiday Trip', 'Vietnam', 'Hồ Chí Minh City', '77777777-7777-7777-7777-777777777777');
insert into itinerary_days (id, trip_id, date) values
  ('d1000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', '2026-12-18');
insert into itinerary_activities (id, day_id, title, start_time, end_time)
values ('a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Massage at Miu Miu Spa', '15:00', '15:30');
select test.ok(test.visible('select * from itinerary_activities') = 1, 'the owner adds an activity');
select test.refused($$insert into itinerary_activities (day_id, title, start_time, end_time) values ('d1000000-0000-0000-0000-000000000001', 'Backwards', '15:00', '14:00')$$,
  'an activity can''t end before it starts');
select test.refused($$insert into itinerary_activities (day_id, title, start_time, end_time) values ('d1000000-0000-0000-0000-000000000001', '   ', '15:00', '16:00')$$,
  'an activity needs a title');

-- ===== Stranger and signed-out visitor =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from itinerary_activities') = 0, 'a stranger sees no activities');
select test.refused($$insert into itinerary_activities (day_id, title, start_time, end_time) values ('d1000000-0000-0000-0000-000000000001', 'Sneaky', '10:00', '11:00')$$,
  'a stranger can''t add an activity');
update itinerary_activities set title = 'Hacked';
delete from itinerary_activities;
select test.act_as(null);
select test.ok(test.visible('select * from itinerary_activities') = 0, 'a signed-out visitor sees no activities');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok((select title from itinerary_activities) = 'Massage at Miu Miu Spa', 'the stranger''s edit and delete had no effect');

-- ===== Guest who joined by link =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('77777777-7777-7777-7777-777777777777');
select test.ok(test.visible('select * from itinerary_activities') = 1, 'a guest who joined sees the activity');
update itinerary_activities set start_time = '15:15', end_time = '16:05' where id = 'a1000000-0000-0000-0000-000000000001';
select test.ok((select end_time from itinerary_activities) = '16:05', 'a guest can move or resize an activity');

-- ===== Deleting the day =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
delete from itinerary_days where id = 'd1000000-0000-0000-0000-000000000001';
select test.ok(test.visible('select * from itinerary_activities') = 0, 'deleting a day removes its activities');
