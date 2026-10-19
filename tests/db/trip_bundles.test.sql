-- Migration 0020 (one invite link for several trips).
-- Cast: A owns trips T1, T2, T3; F owns trip T4; B is signed in (the invited
-- family member); C is an anonymous guest; D a stranger.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'family@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true),
  ('00000000-0000-0000-0000-00000000000d', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000f', 'friend@test.local', false);

select test.act_as('00000000-0000-0000-0000-00000000000f');
insert into trips (id, name, country, city_primary, invite_token) values
  ('44444444-4444-4444-4444-444444444444', 'Friend Trip', 'Japan', 'Osaka', '84444444-4444-4444-4444-444444444444');

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into profiles (display_name) values ('Hanh');
insert into trips (id, name, country, city_primary, invite_token, start_date) values
  ('11111111-1111-1111-1111-111111111111', 'Tokyo Outbound', 'Japan', 'Tokyo', '81111111-1111-1111-1111-111111111111', '2027-03-02'),
  ('22222222-2222-2222-2222-222222222222', 'Seoul', 'South Korea', 'Seoul', '82222222-2222-2222-2222-222222222222', '2027-03-09'),
  ('33333333-3333-3333-3333-333333333333', 'Tokyo Homebound', 'Japan', 'Tokyo', '83333333-3333-3333-3333-333333333333', '2027-03-20');
select test.refused($$select create_trip_bundle(array['11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444']::uuid[])$$,
  'a link can only include trips you own');
create temp table tok as select create_trip_bundle(array['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']::uuid[]) as t;
grant select on tok to authenticated, anon;
select test.ok(test.visible('select * from trip_bundles') = 1, 'the owner sees their link');
select test.refused($$insert into trip_bundles (trip_ids) values (array['44444444-4444-4444-4444-444444444444']::uuid[])$$,
  'links are made only through the function');

-- ===== B (signed in) previews and joins all three =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from trip_bundles') = 0, 'others don''t see the owner''s links');
select test.ok((select count(*) from trip_bundle_preview((select t from tok))) = 3, 'the preview lists the 3 trips');
select test.ok((select string_agg(name, ', ') from trip_bundle_preview((select t from tok))) = 'Tokyo Outbound, Seoul, Tokyo Homebound', 'in date order');
select test.ok((select bool_and(from_name = 'Hanh') from trip_bundle_preview((select t from tok))), 'it says who it''s from');
select join_trip_via_invite('82222222-2222-2222-2222-222222222222');
select test.ok((select already from trip_bundle_preview((select t from tok)) where name = 'Seoul'), 'a trip already joined is marked');
select test.ok((select join_trips_via_bundle((select t from tok))) = 2, 'joining adds the two trips not yet joined');
select test.ok((select count(*) from trip_members where user_id = '00000000-0000-0000-0000-00000000000b') = 3, 'B is on all three trips');
select test.ok((select join_trips_via_bundle((select t from tok))) = 0, 'joining again changes nothing');

-- ===== C (anonymous guest) can't use it =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select test.refused($$select join_trips_via_bundle((select t from tok))$$, 'an anonymous guest can''t join with it');
select test.refused($$select * from trip_bundle_preview((select t from tok))$$, 'an anonymous guest can''t preview it');
select test.refused($$select create_trip_bundle(array['11111111-1111-1111-1111-111111111111']::uuid[])$$, 'an anonymous guest can''t make one');

-- ===== Signed out =====
select test.act_as(null);
select test.refused($$select join_trips_via_bundle((select t from tok))$$, 'a signed-out visitor can''t join');

-- ===== A stops the link; D can no longer join =====
select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.refused($$select stop_trip_bundle((select id from trip_bundles limit 1))$$, 'only the owner can stop a link');
select test.act_as('00000000-0000-0000-0000-00000000000a');
select stop_trip_bundle((select id from trip_bundles limit 1));
select test.ok((select stopped_at is not null from trip_bundles), 'the owner stops the link');
select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from trip_bundle_preview((select t from tok))) = 0, 'a stopped link shows nothing');
select test.refused($$select join_trips_via_bundle((select t from tok))$$, 'a stopped link can''t be used');
select test.ok((select count(*) from trip_members where user_id = '00000000-0000-0000-0000-00000000000d') = 0, 'D joined nothing');
