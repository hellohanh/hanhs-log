-- Migration 0011 (the old-Wanderlog pin import queue, E71).
-- Cast: A owns the Savorlog circle; B is signed-in family in the circle;
-- C is A's trip co-traveler (anonymous guest); D is a stranger.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'family@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true),
  ('00000000-0000-0000-0000-00000000000d', 'stranger@test.local', false);

select test.act_as('00000000-0000-0000-0000-00000000000a');
select claim_savorlog();
-- B joins the circle (as the invite would; 0009 tests the invite itself).
reset role;
insert into savorlog_members (user_id, role) values ('00000000-0000-0000-0000-00000000000b', 'member');

-- ===== A (Savorlog owner) loads two places =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into pin_import_items (google_place_id, city, country, lat, lng, prefill, copies) values
  ('gp-cathedral', 'Hồ Chí Minh City', 'Vietnam', 10.78, 106.699, '{"category":"attraction"}', '[{"name":"Nhà Thờ Đúc Bà"}]'),
  ('gp-pho10', 'Hà Nội', 'Vietnam', 21.03, 105.85, '{"category":"food","michelin":"mentioned"}', '[]');
select test.ok(test.visible('select * from pin_import_items') = 2, 'the Savorlog owner loads the import');
select test.refused($$insert into pin_import_items (google_place_id, city, lat, lng) values ('gp-cathedral', 'Hồ Chí Minh City', 1, 1)$$,
  'loading the same place twice is refused (reloading never duplicates)');
update pin_import_items set status = 'skipped', done_at = now() where google_place_id = 'gp-cathedral';
select test.ok((select status from pin_import_items where google_place_id = 'gp-cathedral') = 'skipped', 'the owner can skip a place');
select test.refused($$update pin_import_items set status = 'maybe' where google_place_id = 'gp-pho10'$$,
  'only pending / saved / skipped are allowed');
select test.refused($$delete from pin_import_items where google_place_id = 'gp-pho10'$$,
  'nobody can delete an import row (skips stay skipped)');
select test.refused($$update pin_import_items set owner_id = '00000000-0000-0000-0000-00000000000d' where google_place_id = 'gp-pho10'$$,
  'the owner can''t hand rows to someone else');

-- ===== B (family in the circle) =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from pin_import_items') = 0, 'family can''t see the owner''s import');
select test.refused($$insert into pin_import_items (google_place_id, city, lat, lng) values ('gp-x', 'Huế', 1, 1)$$,
  'family can''t load an import (Savorlog owner only)');
update pin_import_items set status = 'saved' where google_place_id = 'gp-pho10';
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok((select status from pin_import_items where google_place_id = 'gp-pho10') = 'pending', 'family can''t change the owner''s import');

-- ===== C (anonymous guest) and D (stranger) =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select test.ok(test.visible('select * from pin_import_items') = 0, 'a guest can''t see the import');
select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.ok(test.visible('select * from pin_import_items') = 0, 'a stranger can''t see the import');
select test.refused($$insert into pin_import_items (google_place_id, city, lat, lng) values ('gp-y', 'Huế', 1, 1)$$,
  'a stranger can''t load an import');
select test.act_as(null);
select test.ok(test.visible('select * from pin_import_items') = 0, 'a signed-out visitor sees nothing');
