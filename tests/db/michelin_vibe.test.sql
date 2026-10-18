-- Migration 0016 (Bib Gourmand and the Vibe ticks).
-- Cast: owner A (owns a trip, so can add catalogue eateries), stranger B.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, invite_token)
values ('66666666-6666-6666-6666-666666666666', 'Pho Trip', 'Vietnam', 'Hồ Chí Minh City', '88888888-8888-8888-8888-888888888888');

-- Bib Gourmand is a MICHELIN level on pins and eateries.
insert into pins (id, trip_id, name, lat, lng, category, subcategory, michelin, michelin_year, food_truck, community_seating)
values ('b1600000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'Bánh Mì Cart', 10.77, 106.69, 'food', 'vietnamese', 'bib', 2026, true, true);
select test.ok((select michelin from pins where id = 'b1600000-0000-0000-0000-000000000001') = 'bib', 'a food pin can be Bib Gourmand');
select test.ok((select food_truck and community_seating from pins where id = 'b1600000-0000-0000-0000-000000000001'), 'several Vibe ticks save together on a pin');

insert into eateries (id, name, lat, lng, cuisine, michelin, michelin_year, dine_in, fine_dining, outdoor_seating, food_court, counter_seating, takeaway)
values ('e1600000-0000-0000-0000-000000000001', 'Phở Chào', 10.78, 106.69, 'vietnamese', 'bib', 2026, true, true, true, true, true, true);
select test.ok((select michelin from eateries where id = 'e1600000-0000-0000-0000-000000000001') = 'bib', 'an eatery can be Bib Gourmand');
select test.ok((select dine_in and fine_dining and outdoor_seating and food_court and counter_seating and takeaway
  from eateries where id = 'e1600000-0000-0000-0000-000000000001'), 'every Vibe tick saves on an eatery');

-- Selected keeps its saved value; nothing else sneaks in.
update eateries set michelin = 'mentioned' where id = 'e1600000-0000-0000-0000-000000000001';
select test.ok((select michelin from eateries where id = 'e1600000-0000-0000-0000-000000000001') = 'mentioned', 'Selected still saves as mentioned');
select test.refused($$update eateries set michelin = 'plate' where id = 'e1600000-0000-0000-0000-000000000001'$$,
  'an unknown MICHELIN level is refused on eateries');
select test.refused($$insert into pins (trip_id, name, lat, lng, category, michelin) values ('66666666-6666-6666-6666-666666666666', 'Odd', 10.77, 106.69, 'food', 'plate')$$,
  'an unknown MICHELIN level is refused on pins');

-- MICHELIN and the Vibe ticks are for food and drink pins only.
select test.refused($$insert into pins (trip_id, name, lat, lng, category, michelin) values ('66666666-6666-6666-6666-666666666666', 'Ben Thanh Market', 10.77, 106.69, 'shopping', 'bib')$$,
  'Bib is for food and drink pins only');
select test.refused($$insert into pins (trip_id, name, lat, lng, category, takeaway) values ('66666666-6666-6666-6666-666666666666', 'Ben Thanh Market', 10.77, 106.69, 'shopping', true)$$,
  'a Vibe tick is for food and drink pins only');
select test.refused($$insert into pins (trip_id, name, lat, lng, category, street_food) values ('66666666-6666-6666-6666-666666666666', 'Ben Thanh Market', 10.77, 106.69, 'shopping', true)$$,
  'Street food is still food-only');

-- A stranger sees none of it.
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from pins') = 0, 'a stranger sees no pins');
select test.ok(test.visible('select * from eateries') = 0, 'a stranger sees no eateries');
