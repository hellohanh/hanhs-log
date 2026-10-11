-- Migration 0004 (pins and each person's WTG / VIS review).
-- Cast: owner A, stranger B, guest C (joined by link, no email).

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, invite_token)
values ('66666666-6666-6666-6666-666666666666', 'Pho Trip', 'Vietnam', 'Hồ Chí Minh City', '88888888-8888-8888-8888-888888888888');
insert into pins (id, trip_id, name, lat, lng, category, subcategory, subsubcategory, michelin, michelin_year, street_food)
values ('b1000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'Phở Hòa Pasteur', 10.789, 106.689, 'food', 'vietnamese', 'pho', 'mentioned', 2026, true);
select test.ok(test.visible('select * from pins') = 1, 'the owner adds a pin');
select test.refused($$insert into pins (trip_id, name, lat, lng, category, michelin) values ('66666666-6666-6666-6666-666666666666', 'Ben Thanh Market', 10.77, 106.69, 'shopping', '1')$$,
  'MICHELIN is for food and drink pins only');
select test.refused($$insert into pins (trip_id, name, lat, lng, category) values ('66666666-6666-6666-6666-666666666666', 'Nowhere', 120, 106.69, 'food')$$,
  'a pin needs a real place on the map');
insert into pin_reviews (pin_id, status) values ('b1000000-0000-0000-0000-000000000001', 'wtg');
select test.ok((select user_id from pin_reviews) = '00000000-0000-0000-0000-00000000000a', 'the owner''s review is their own');
select test.refused($$update pin_reviews set status = 'vis' where pin_id = 'b1000000-0000-0000-0000-000000000001'$$,
  'VIS needs a verdict');
update pin_reviews set status = 'vis', verdict = 'revisit', rating = 4.5;
select test.ok((select rating from pin_reviews) = 4.5, 'VIS with a verdict and a half-star rating');
select test.refused($$update pin_reviews set rating = 4.3$$, 'ratings are in half stars');

-- ===== Stranger and signed-out visitor =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from pins') = 0, 'a stranger sees no pins');
select test.ok(test.visible('select * from pin_reviews') = 0, 'a stranger sees no reviews');
select test.refused($$insert into pins (trip_id, name, lat, lng, category) values ('66666666-6666-6666-6666-666666666666', 'Sneaky', 10, 106, 'food')$$,
  'a stranger can''t add a pin');
select test.refused($$insert into pin_reviews (pin_id, status) values ('b1000000-0000-0000-0000-000000000001', 'wtg')$$,
  'a stranger can''t review a pin');
update pins set name = 'Hacked';
delete from pins;
select test.act_as(null);
select test.ok(test.visible('select * from pins') = 0, 'a signed-out visitor sees no pins');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok((select name from pins) = 'Phở Hòa Pasteur', 'the stranger''s edit and delete had no effect');

-- ===== Guest who joined by link =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('88888888-8888-8888-8888-888888888888');
select test.ok(test.visible('select * from pins') = 1, 'a guest who joined sees the pin');
select test.ok(test.visible('select * from pin_reviews') = 1, 'a guest sees the owner''s review');
insert into pin_reviews (pin_id, status, verdict) values ('b1000000-0000-0000-0000-000000000001', 'vis', 'no');
select test.ok(test.visible('select * from pin_reviews') = 2, 'a guest sets their own review');
update pin_reviews set verdict = 'second' where user_id = '00000000-0000-0000-0000-00000000000a';
delete from pin_reviews where user_id = '00000000-0000-0000-0000-00000000000a';
select test.ok((select verdict from pin_reviews where user_id = '00000000-0000-0000-0000-00000000000a') = 'revisit',
  'a guest can''t change or clear someone else''s review');
select test.refused($$insert into pin_reviews (pin_id, user_id, status) values ('b1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'wtg')$$,
  'nobody can write a review in someone else''s name');
update pins set note = 'Go before 9' where id = 'b1000000-0000-0000-0000-000000000001';
select test.ok((select note from pins) = 'Go before 9', 'a guest can edit a pin');

-- ===== Deleting the pin =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
delete from pins where id = 'b1000000-0000-0000-0000-000000000001';
select test.ok(test.visible('select * from pin_reviews') = 0, 'deleting a pin removes its reviews');
