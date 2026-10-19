-- Migration 0021 (Roaminglog: the shared spot catalogue + two-stage delete).
-- Cast: A owns the Savorlog circle and a HCMC trip; B is a stranger (no circle,
-- no trip); C joined A's trip by link (anonymous, not in the circle); E is in
-- the circle (family) with no trips.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true),
  ('00000000-0000-0000-0000-00000000000e', 'family@test.local', false);

-- ===== A: owner of the circle, adds spots =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
select claim_savorlog();
insert into trips (id, name, country, city_primary, invite_token)
values ('66666666-6666-6666-6666-666666666666', 'Saigon', 'Vietnam', 'Hồ Chí Minh City', '88888888-8888-8888-8888-888888888888');
insert into spots (id, google_place_id, name, lat, lng, category, subcategory, note)
values ('51000000-0000-0000-0000-000000000001', 'g-ben-thanh', 'Bến Thành Market', 10.772, 106.698, 'shopping', 'market', 'Go early');
insert into spots (id, google_place_id, name, lat, lng, category, subcategory)
values ('52000000-0000-0000-0000-000000000002', 'g-meiji', 'Meiji Shrine', 35.676, 139.699, 'attraction', 'worship');
select test.ok(test.visible('select * from spots') = 2, 'the circle owner sees the whole spot catalogue, near or far');
select test.refused($$insert into spots (name, lat, lng, category) values ('Phở stall', 10.77, 106.69, 'food')$$,
  'food isn''t a spot (eateries live in Savorlog)');
select test.refused($$insert into spots (google_place_id, name, lat, lng, category) values ('g-ben-thanh', 'Again', 10.77, 106.69, 'shopping')$$,
  'one spot per Google place');
insert into spot_reviews (spot_id, status) values ('51000000-0000-0000-0000-000000000001', 'wtg');
select test.ok((select user_id from spot_reviews) = '00000000-0000-0000-0000-00000000000a', 'the owner''s review is their own');
select test.refused($$update spot_reviews set status = 'vis'$$, 'VIS needs a verdict');

-- ===== B: a stranger =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from spots') = 0, 'a stranger sees no spots');
select test.ok(test.visible('select * from spot_reviews') = 0, 'a stranger sees no spot reviews');
select test.refused($$insert into spots (name, lat, lng, category) values ('Sneaky', 10.78, 106.69, 'attraction')$$, 'a stranger can''t add a spot');
select test.refused($$select request_spot_deletion('51000000-0000-0000-0000-000000000001')$$, 'a stranger can''t remove a spot');
update spots set name = 'Hacked';
select test.act_as(null);
select test.ok(test.visible('select * from spots') = 0, 'a signed-out visitor sees no spots');

-- ===== C: a co-traveler on A's trip (anonymous guest) =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('88888888-8888-8888-8888-888888888888');
select test.ok(test.visible('select * from spots') = 2, 'a co-traveler sees every spot, near or far');
select test.ok((select name from spots where id = '51000000-0000-0000-0000-000000000001') = 'Bến Thành Market', 'the stranger''s edit changed nothing');
insert into spots (id, google_place_id, name, lat, lng, category, subcategory)
values ('53000000-0000-0000-0000-000000000003', 'g-reverie', 'The Reverie Saigon', 10.775, 106.705, 'accommodation', 'hotel');
update spots set note = 'Rooftop view' where id = '53000000-0000-0000-0000-000000000003';
select test.ok((select note from spots where id = '53000000-0000-0000-0000-000000000003') = 'Rooftop view', 'a co-traveler adds and edits spots');
insert into spot_reviews (spot_id, status, verdict, rating) values ('51000000-0000-0000-0000-000000000001', 'vis', 'revisit', 4.5);
select test.ok(test.visible('select * from spot_reviews') = 2, 'a co-traveler sees everyone''s status and adds their own');
select test.refused($$delete from spots where id = '53000000-0000-0000-0000-000000000003'$$, 'nobody deletes a spot directly');

-- Two-stage delete: C queues one…
select request_spot_deletion('52000000-0000-0000-0000-000000000002');
select test.ok(test.visible('select * from spots') = 2, 'a queued spot hides from everyone but the owner');
select test.refused($$select finalize_spot_deletion('52000000-0000-0000-0000-000000000002')$$, 'a co-traveler can''t finalize a removal');
select test.refused($$select restore_spot('52000000-0000-0000-0000-000000000002')$$, 'a co-traveler can''t restore a spot');

-- ===== E: family member (in the circle, no trips) =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok(test.visible('select * from spots where deleted_at is not null') = 1, 'the owner sees the queued spot');
create temp table fam as select savorlog_invite() as t;
grant select on fam to authenticated;
select test.act_as('00000000-0000-0000-0000-00000000000e');
select join_savorlog_via_invite((select t from fam));
select test.ok(test.visible('select * from spots') = 2, 'a family member sees the live spots without any trip');

-- ===== A: owner restores, then finalizes another =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
select restore_spot('52000000-0000-0000-0000-000000000002');
select test.ok((select deleted_at is null from spots where id = '52000000-0000-0000-0000-000000000002'), 'the owner restores a queued spot');
select request_spot_deletion('53000000-0000-0000-0000-000000000003');
select finalize_spot_deletion('53000000-0000-0000-0000-000000000003');
select test.ok(test.visible('select * from spots') = 2, 'the owner finalizes a removal for good');
