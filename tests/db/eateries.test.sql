-- Migration 0007 (the shared Savorlog eatery catalogue + two-stage delete).
-- Cast: A owns the circle and a HCMC trip; B is a stranger (no circle, no
-- trip); C is a co-traveler who joined A's trip by link (anonymous, not in the
-- circle). HCMC ≈ (10.78, 106.69); Paris ≈ (48.85, 2.35) is far from the trip.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true);

-- ===== A: claims the circle, makes a trip, adds eateries =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok(claim_savorlog() = 'owner', 'the first signed-in person owns the circle');
select test.ok(test.visible('select * from savorlog_members') = 1, 'the owner is in the circle');

insert into trips (id, name, country, city_primary, invite_token, map_lat, map_lng)
values ('66666666-6666-6666-6666-666666666666', 'Saigon', 'Vietnam', 'Hồ Chí Minh City',
        '88888888-8888-8888-8888-888888888888', 10.78, 106.69);

insert into eateries (id, google_place_id, name, lat, lng, cuisine, dish, michelin, michelin_year, street_food, price)
values ('e1000000-0000-0000-0000-000000000001', 'gp-anan', 'Anan Saigon', 10.789, 106.689, 'vietnamese', null, '1', 2025, false, 4);
insert into eateries (id, google_place_id, name, lat, lng, cuisine, dish, price)
values ('e2000000-0000-0000-0000-000000000002', 'gp-paris', 'Chez Far Away', 48.85, 2.35, 'french', null, 3);
select test.ok(test.visible('select * from eateries') = 2, 'a circle member sees the whole catalogue, near or far');
select test.refused($$insert into eateries (name, lat, lng, price) values ('Bad', 10, 106, 9)$$,
  'price is limited to $–$$$$');

insert into eatery_reviews (eatery_id, status) values ('e1000000-0000-0000-0000-000000000001', 'wtg');
select test.ok((select user_id from eatery_reviews) = '00000000-0000-0000-0000-00000000000a', 'the owner''s review is their own');

-- ===== B: a stranger with no circle and no trip =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from eateries') = 0, 'a stranger sees no eateries');
select test.ok(test.visible('select * from savorlog_members') = 0, 'a stranger doesn''t see the circle');
select test.refused($$insert into eateries (name, lat, lng) values ('Sneaky', 10.78, 106.69)$$,
  'a stranger can''t add an eatery');
select test.refused($$insert into eatery_reviews (eatery_id, status) values ('e1000000-0000-0000-0000-000000000001', 'wtg')$$,
  'a stranger can''t review an eatery');

-- ===== C: a co-traveler who joined the trip by link =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('88888888-8888-8888-8888-888888888888');
select test.ok(test.visible('select * from eateries') = 1, 'a co-traveler sees only eateries in the trip''s city');
insert into eatery_reviews (eatery_id, status, verdict, rating) values ('e1000000-0000-0000-0000-000000000001', 'vis', 'revisit', 4.5);
select test.ok(test.visible('select * from eatery_reviews') = 2, 'a co-traveler adds their own review');
insert into eateries (id, google_place_id, name, lat, lng, cuisine, dish)
values ('e3000000-0000-0000-0000-000000000003', 'gp-pho', 'Phở Hòa Pasteur', 10.782, 106.686, 'vietnamese', 'pho');
select test.ok(test.visible('select * from eateries') = 2, 'a co-traveler adds an eatery in the trip''s city');
select test.ok((select count(*) from trip_eateries('66666666-6666-6666-6666-666666666666')) = 2,
  'trip_eateries returns the two in the city, not the far one');

-- Two-stage delete: C can queue one (anyone who can see it)…
select request_eatery_deletion('e1000000-0000-0000-0000-000000000001');
select test.ok(test.visible('select * from eateries') = 1, 'a queued eatery hides from everyone but the owner');
select test.refused($$select finalize_eatery_deletion('e1000000-0000-0000-0000-000000000001')$$,
  'a co-traveler can''t finalize a deletion');
select test.refused($$select restore_eatery('e1000000-0000-0000-0000-000000000001')$$,
  'a co-traveler can''t restore a queued eatery');

-- …only the owner finalizes.
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok(test.visible('select * from eateries') = 3, 'the owner still sees the queued eatery, pending review');
select finalize_eatery_deletion('e1000000-0000-0000-0000-000000000001');
select test.ok(test.visible('select * from eateries') = 2, 'finalizing removes the eatery for good');
select test.ok(test.visible('select * from eatery_reviews') = 0, 'its reviews go with it');
