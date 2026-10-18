-- Migration 0018 (copy all pins from one trip to another).
-- Cast: A owns trips T1 (Homebound) and T2 (Outbound); D is on T1 only;
-- E is on both; B is a stranger.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000d', 'one@test.local', false),
  ('00000000-0000-0000-0000-00000000000e', 'both@test.local', false);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, invite_token) values
  ('11111111-1111-1111-1111-111111111111', 'Tokyo Homebound', 'Japan', 'Tokyo', '81111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222', 'Tokyo Outbound', 'Japan', 'Tokyo', '82222222-2222-2222-2222-222222222222');
insert into pins (id, trip_id, google_place_id, name, lat, lng, category, subcategory, note) values
  ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'g-meiji', 'Meiji Shrine', 35.676, 139.699, 'attraction', 'worship', 'Go early'),
  ('a1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'g-hotel', 'Park Hyatt', 35.685, 139.690, 'accommodation', 'hotel', null),
  ('a1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', null, 'Secret Spot', 35.66, 139.70, 'attraction', null, null),
  ('a2000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'g-hotel', 'Park Hyatt', 35.685, 139.690, 'accommodation', 'hotel', null);
insert into pin_reviews (pin_id, status, verdict, rating) values ('a1000000-0000-0000-0000-000000000001', 'vis', 'revisit', 4.5);

-- D joins T1, E joins both; E rates the shrine too.
select test.act_as('00000000-0000-0000-0000-00000000000d');
select join_trip_via_invite('81111111-1111-1111-1111-111111111111');
select test.act_as('00000000-0000-0000-0000-00000000000e');
select join_trip_via_invite('81111111-1111-1111-1111-111111111111');
select join_trip_via_invite('82222222-2222-2222-2222-222222222222');
insert into pin_reviews (pin_id, status) values ('a1000000-0000-0000-0000-000000000001', 'wtg');

-- ===== B, a stranger, and D (on one trip only) can't copy =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.refused($$select copy_trip_pins('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')$$, 'a stranger can''t copy pins');
select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.refused($$select copy_trip_pins('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')$$, 'someone on only one of the trips can''t copy');
select test.act_as(null);
select test.refused($$select copy_trip_pins('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')$$, 'a signed-out visitor can''t copy');

-- ===== E, on both trips, copies =====
select test.act_as('00000000-0000-0000-0000-00000000000e');
select test.refused($$select copy_trip_pins('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222')$$, 'a trip can''t copy into itself');
select test.ok((select copy_trip_pins('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')::jsonb) = '{"copied": 2, "skipped": 1}'::jsonb,
  'copies the shrine and the secret spot, skips the hotel already there');
select test.ok((select count(*) from pins where trip_id = '22222222-2222-2222-2222-222222222222') = 3, 'the receiving trip now has 3 pins, no doubles');
select test.ok((select note from pins where trip_id = '22222222-2222-2222-2222-222222222222' and google_place_id = 'g-meiji') = 'Go early', 'the note comes along');
select test.ok((select count(*) from pin_reviews r join pins p on p.id = r.pin_id where p.trip_id = '22222222-2222-2222-2222-222222222222' and p.google_place_id = 'g-meiji') = 2,
  'everyone''s WTG / VIS comes along');
select test.ok((select rating from pin_reviews r join pins p on p.id = r.pin_id where p.trip_id = '22222222-2222-2222-2222-222222222222' and r.user_id = '00000000-0000-0000-0000-00000000000a') = 4.5,
  'ratings come along');
select test.ok((select count(*) from pins where trip_id = '11111111-1111-1111-1111-111111111111') = 3, 'the original trip is unchanged');
select test.ok((select copy_trip_pins('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')::jsonb ->> 'skipped') = '2',
  'copying again skips the places already there');
