-- Migration 0017 (your own main dishes).
-- Cast: A owns the Savorlog circle and a trip; D joined that trip by link (not
-- in the circle); B is a stranger (no circle, no trip).

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000d', 'friend@test.local', false);

select test.act_as('00000000-0000-0000-0000-00000000000a');
select claim_savorlog();
insert into trips (id, name, country, city_primary, invite_token)
values ('66666666-6666-6666-6666-666666666666', 'Saigon', 'Vietnam', 'Hồ Chí Minh City', '88888888-8888-8888-8888-888888888888');
insert into custom_dishes (cuisine, key, label) values ('vietnamese', 'x-bun-mam', 'Bún Mắm');
select test.ok(test.visible('select * from custom_dishes') = 1, 'the circle owner adds a dish');
select test.ok((select created_by from custom_dishes) = '00000000-0000-0000-0000-00000000000a', 'the dish is credited to who added it');
select test.refused($$insert into custom_dishes (cuisine, key, label) values ('vietnamese', 'x-bun-mam', 'Bún Mắm again')$$,
  'the same dish can''t be added twice to a cuisine');
insert into custom_dishes (cuisine, key, label) values ('thai', 'x-bun-mam', 'Bún Mắm');
select test.ok(test.visible($$select * from custom_dishes where key = 'x-bun-mam'$$) = 2, 'the same key under another cuisine is its own dish');
select test.refused($$insert into custom_dishes (cuisine, key, label) values ('vietnamese', 'pho', 'Phở')$$,
  'added keys must start with x- (never a built-in key)');
select test.refused($$insert into custom_dishes (cuisine, key, label, created_by) values ('vietnamese', 'x-banh-tet', 'Bánh Tét', '00000000-0000-0000-0000-00000000000d')$$,
  'nobody adds a dish in someone else''s name');
select test.refused($$update custom_dishes set label = 'Changed'$$, 'dishes can''t be renamed');
select test.refused($$delete from custom_dishes$$, 'dishes can''t be removed');

-- ===== D: on a trip, not in the circle =====
select test.act_as('00000000-0000-0000-0000-00000000000d');
select join_trip_via_invite('88888888-8888-8888-8888-888888888888');
select test.ok(test.visible('select * from custom_dishes') = 2, 'a co-traveler sees the added dishes');
insert into custom_dishes (cuisine, key, label) values ('fusion', 'x-pho-burrito', 'Phở Burrito');
select test.ok(test.visible($$select * from custom_dishes where cuisine = 'fusion'$$) = 1, 'a co-traveler adds a dish (Fusion too)');

-- ===== B: stranger and signed-out =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from custom_dishes') = 0, 'a stranger sees no added dishes');
select test.refused($$insert into custom_dishes (cuisine, key, label) values ('vietnamese', 'x-sneaky', 'Sneaky')$$,
  'a stranger can''t add a dish');
select test.act_as(null);
select test.ok(test.visible('select * from custom_dishes') = 0, 'a signed-out visitor sees no added dishes');
