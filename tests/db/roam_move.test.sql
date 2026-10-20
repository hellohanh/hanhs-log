-- Migration 0022's move, run again here on sample pins (the template had
-- none when it first ran). Hanh's rules: details from the newest copy, notes
-- joined oldest first (each once), a VIS beats WTG, then the most recent;
-- itinerary blocks follow; food pins stay.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000f', 'family@test.local', false);

reset role;
insert into trips (id, name, country, city_primary, invite_token, owner_id) values
  ('61000000-0000-0000-0000-000000000001', 'Tokyo outbound', 'Japan', 'Tokyo', '81000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a'),
  ('62000000-0000-0000-0000-000000000002', 'Tokyo homebound', 'Japan', 'Tokyo', '82000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a');
insert into itinerary_days (id, trip_id, date) values ('d0000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', '2026-12-20');
insert into pins (id, trip_id, google_place_id, name, lat, lng, category, subcategory, note, created_at) values
  ('a1000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'g-meiji', 'Meiji Shrine', 35.676, 139.699, 'attraction', 'park', 'Go early', '2026-10-01'),
  ('a2000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002', 'g-meiji', 'Meiji Jingu', 35.676, 139.699, 'attraction', 'worship', 'Wear good shoes', '2026-10-05'),
  ('a3000000-0000-0000-0000-000000000003', '62000000-0000-0000-0000-000000000002', 'g-hnd', 'Haneda Airport', 35.549, 139.779, 'airport', null, 'Go early', '2026-10-06'),
  ('a4000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000001', 'g-ramen', 'Ichiran', 35.66, 139.70, 'food', 'japanese', null, '2026-10-02');
insert into pin_reviews (pin_id, user_id, status, verdict, rating, updated_at) values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'vis', 'revisit', 4.5, '2026-10-02'),
  ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'wtg', null, null, '2026-10-09'),
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000f', 'wtg', null, null, '2026-10-02'),
  ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000f', 'wtg', null, null, '2026-10-08');
insert into itinerary_stops (id, day_id, pin_id, start_time, end_time) values
  ('c1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '09:00', '10:00');

begin;
\i supabase/migrations/0022_move_pins_to_spots.sql
commit;

select test.ok((select count(*) from spots) = 2, 'two places → two spots (the two Meiji copies merged)');
select test.ok((select name || '/' || subcategory from spots where google_place_id = 'g-meiji') = 'Meiji Jingu/worship', 'details come from the newest copy');
select test.ok((select note from spots where google_place_id = 'g-meiji') = E'Go early\nWear good shoes', 'notes joined, oldest first, one per line');
select test.ok((select created_at::date from spots where google_place_id = 'g-meiji') = '2026-10-01', 'the spot keeps the first time it was added');
select test.ok((select status || coalesce(verdict, '') from spot_reviews r join spots s on s.id = r.spot_id
                where s.google_place_id = 'g-meiji' and r.user_id = '00000000-0000-0000-0000-00000000000a') = 'visrevisit', 'a VIS beats a newer WTG');
select test.ok((select r.updated_at::date from spot_reviews r join spots s on s.id = r.spot_id
                where s.google_place_id = 'g-meiji' and r.user_id = '00000000-0000-0000-0000-00000000000f') = '2026-10-08', 'between two WTGs the newest wins');
select test.ok((select s.google_place_id from itinerary_stops st join spots s on s.id = st.spot_id where st.id = 'c1000000-0000-0000-0000-000000000001') = 'g-meiji'
               and (select pin_id from itinerary_stops where id = 'c1000000-0000-0000-0000-000000000001') is null, 'the itinerary block now points at the spot');
select test.ok((select count(*) from pins) = 1 and (select category from pins) = 'food', 'only the food pin is left on the trips');
select test.ok((select count(*) from pin_reviews) = 0, 'the moved pins'' reviews went with them (copied first)');

-- Running it again changes nothing (no pins left to move).
begin;
\i supabase/migrations/0022_move_pins_to_spots.sql
commit;
select test.ok((select count(*) from spots) = 2 and (select count(*) from spot_reviews) = 2, 'running the move twice is harmless');
