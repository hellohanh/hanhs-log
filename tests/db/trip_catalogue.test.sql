-- Migration 0015 (everyone on a trip sees the whole Savorlog catalogue).
-- Cast: A owns the circle and a past HCMC trip; C is a link guest on that trip
-- (anonymous, not in the circle); D is signed in and joined the trip by link
-- (not in the circle); B is a stranger (no circle, no trip). Paris and Tokyo
-- are far from the trip.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true),
  ('00000000-0000-0000-0000-00000000000d', 'friend@test.local', false);

select test.act_as('00000000-0000-0000-0000-00000000000a');
select claim_savorlog();
insert into trips (id, name, country, city_primary, invite_token, map_lat, map_lng, start_date, end_date)
values ('66666666-6666-6666-6666-666666666666', 'Saigon 2024', 'Vietnam', 'Hồ Chí Minh City',
        '88888888-8888-8888-8888-888888888888', 10.78, 106.69, '2024-01-01', '2024-01-10');
insert into itinerary_days (id, trip_id, date) values ('d0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', '2024-01-02');
insert into eateries (id, name, lat, lng, cuisine) values ('e1000000-0000-0000-0000-000000000001', 'Phở Hòa', 10.789, 106.689, 'vietnamese');
insert into eateries (id, name, lat, lng, cuisine) values ('e2000000-0000-0000-0000-000000000002', 'Chez Far Away', 48.85, 2.35, 'french');
insert into eatery_reviews (eatery_id, status, verdict) values ('e2000000-0000-0000-0000-000000000002', 'vis', 'revisit');

-- ===== B: a stranger still sees nothing =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from eateries') = 0, 'a stranger with no trip sees no eateries');
select test.ok(test.visible('select * from eatery_reviews') = 0, 'a stranger sees no statuses');
select test.refused($$insert into eateries (name, lat, lng) values ('Sneaky', 35.67, 139.74)$$,
  'a stranger can''t add an eatery anywhere');
select test.ok((select count(*) from trip_eateries('66666666-6666-6666-6666-666666666666')) = 0,
  'trip_eateries returns nothing to someone not on the trip');

-- ===== C: a link guest on a past trip =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('88888888-8888-8888-8888-888888888888');
select test.ok(test.visible('select * from eateries') = 2, 'a link guest on a past trip sees the whole catalogue');
select test.ok(test.visible('select * from eatery_reviews') = 1, 'a link guest sees people''s statuses on far eateries');
update eateries set note = 'Try the duck' where id = 'e2000000-0000-0000-0000-000000000002';
select test.ok((select note from eateries where id = 'e2000000-0000-0000-0000-000000000002') = 'Try the duck',
  'a link guest edits a far eatery');
insert into eateries (id, name, lat, lng, cuisine) values ('e3000000-0000-0000-0000-000000000003', 'Sushi Far', 35.67, 139.74, 'japanese');
select test.ok(test.visible('select * from eateries') = 3, 'a link guest adds an eatery far from the trip');
insert into itinerary_stops (day_id, eatery_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000003', '12:00', '13:00');
select test.ok(test.visible('select * from itinerary_stops') = 1, 'a far eatery goes on a day');
select test.ok((select count(*) from trip_eateries('66666666-6666-6666-6666-666666666666')) = 3,
  'trip_eateries returns every live eatery');
select test.ok(test.visible('select * from savorlog_members') = 0, 'a link guest still doesn''t see the family circle');
select test.refused($$select savorlog_invite()$$, 'a link guest can''t get the family invite');
select test.refused($$select savorlog_people()$$, 'a link guest can''t list the family');

-- ===== D: a signed-in co-traveler, not in the family =====
select test.act_as('00000000-0000-0000-0000-00000000000d');
select join_trip_via_invite('88888888-8888-8888-8888-888888888888');
select test.ok(test.visible('select * from eateries') = 3, 'a signed-in co-traveler sees the whole catalogue');
select request_eatery_deletion('e2000000-0000-0000-0000-000000000002');
select test.ok(test.visible('select * from eateries') = 2, 'a co-traveler queues a far eatery for removal');
select test.refused($$select finalize_eatery_deletion('e2000000-0000-0000-0000-000000000002')$$,
  'only the owner finalizes a removal');

-- Removed from the trip → back to nothing.
select test.act_as('00000000-0000-0000-0000-00000000000a');
select remove_trip_member('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-00000000000d');
select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.ok(test.visible('select * from eateries') = 0, 'someone removed from their only trip sees no eateries');
