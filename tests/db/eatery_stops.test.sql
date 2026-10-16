-- Migration 0010 (an itinerary stop can be a trip pin or a catalogue eatery).
-- A owns a HCMC trip + the circle. HCMC ≈ (10.78,106.69); an eatery there is
-- schedulable, and since 0015 so is a far one (Tokyo).

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false);

select test.act_as('00000000-0000-0000-0000-00000000000a');
select claim_savorlog();
insert into trips (id, name, country, city_primary, invite_token, map_lat, map_lng)
values ('66666666-6666-6666-6666-666666666666', 'Saigon', 'Vietnam', 'Hồ Chí Minh City', '88888888-8888-8888-8888-888888888888', 10.78, 106.69);
insert into itinerary_days (id, trip_id, date) values ('d0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', '2026-12-20');
insert into pins (id, trip_id, name, lat, lng, category) values ('b1000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'Bến Thành Market', 10.77, 106.698, 'shopping');
insert into eateries (id, name, lat, lng, cuisine) values ('e1000000-0000-0000-0000-000000000001', 'Phở Hòa Pasteur', 10.789, 106.689, 'vietnamese');
insert into eateries (id, name, lat, lng, cuisine) values ('e2000000-0000-0000-0000-000000000002', 'Sushi Saito', 35.67, 139.74, 'japanese');

-- A pin stop still works.
insert into itinerary_stops (day_id, pin_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '09:00', '10:00');
select test.ok(test.visible('select * from itinerary_stops') = 1, 'a pin can still be scheduled');

-- An eatery in the trip's city can be scheduled.
insert into itinerary_stops (day_id, eatery_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', '12:00', '13:00');
select test.ok(test.visible('select * from itinerary_stops') = 2, 'an eatery in the city can be scheduled');

-- A far eatery can too (0015: any eatery you can see).
insert into itinerary_stops (day_id, eatery_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', '14:00', '15:00');
select test.ok(test.visible('select * from itinerary_stops') = 3, 'a far eatery can be scheduled (0015)');

-- Exactly one of pin / eatery.
select test.refused($$insert into itinerary_stops (day_id, pin_id, eatery_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', '16:00', '17:00')$$,
  'a stop can''t be both a pin and an eatery');
select test.refused($$insert into itinerary_stops (day_id, start_time, end_time) values ('d0000000-0000-0000-0000-000000000001', '18:00', '19:00')$$,
  'a stop must be a pin or an eatery');

-- Finalizing the eatery removes its stop.
select request_eatery_deletion('e1000000-0000-0000-0000-000000000001');
select finalize_eatery_deletion('e1000000-0000-0000-0000-000000000001');
select test.ok(test.visible('select * from itinerary_stops') = 2, 'removing an eatery clears its stops');
