-- Migration 0008 (eatery photos: metadata rows gated by the eatery's own
-- visibility). Cast: A owns the circle + a HCMC trip; B is a stranger; C is a
-- co-traveler who joined A's trip by link.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

select test.act_as('00000000-0000-0000-0000-00000000000a');
select claim_savorlog();
insert into trips (id, name, country, city_primary, invite_token, map_lat, map_lng)
values ('66666666-6666-6666-6666-666666666666', 'Saigon', 'Vietnam', 'Hồ Chí Minh City', '88888888-8888-8888-8888-888888888888', 10.78, 106.69);
insert into eateries (id, google_place_id, name, lat, lng, cuisine, dish)
values ('e1000000-0000-0000-0000-000000000001', 'gp-anan', 'Anan Saigon', 10.789, 106.689, 'vietnamese', null);
insert into eatery_photos (eatery_id, path, sort) values ('e1000000-0000-0000-0000-000000000001', 'e1/one.jpg', 0);
select test.ok(test.visible('select * from eatery_photos') = 1, 'the owner adds a photo');

-- ===== Stranger: no circle, no trip =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from eatery_photos') = 0, 'a stranger sees no photos');
select test.refused($$insert into eatery_photos (eatery_id, path) values ('e1000000-0000-0000-0000-000000000001', 'e1/sneak.jpg')$$,
  'a stranger can''t add a photo');

-- ===== Co-traveler on the trip =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('88888888-8888-8888-8888-888888888888');
select test.ok(test.visible('select * from eatery_photos') = 1, 'a co-traveler sees the eatery''s photos');
insert into eatery_photos (eatery_id, path, sort) values ('e1000000-0000-0000-0000-000000000001', 'e1/two.jpg', 1);
select test.ok(test.visible('select * from eatery_photos') = 2, 'a co-traveler adds a photo');
delete from eatery_photos where path = 'e1/two.jpg';
select test.ok(test.visible('select * from eatery_photos') = 1, 'a co-traveler can remove a shared photo');

-- ===== Photos go when the eatery is finalized =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
select request_eatery_deletion('e1000000-0000-0000-0000-000000000001');
select finalize_eatery_deletion('e1000000-0000-0000-0000-000000000001');
select test.ok(test.visible('select * from eatery_photos') = 0, 'finalizing the eatery removes its photos');
