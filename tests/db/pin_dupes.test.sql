-- Migration 0014 (one pin per Google place per trip).
-- Cast: owner A; member B (invited); stranger C.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'friend@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@test.local', false);

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, invite_token) values
  ('66666666-6666-6666-6666-666666666666', 'Saigon', 'Vietnam', 'Hồ Chí Minh City', '88888888-8888-8888-8888-888888888888'),
  ('77777777-7777-7777-7777-777777777777', 'Saigon again', 'Vietnam', 'Hồ Chí Minh City', '99999999-9999-9999-9999-999999999999');
insert into pins (id, trip_id, google_place_id, name, lat, lng, category)
values ('b1000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666', 'gp-cathedral', 'Notre Dame Cathedral of Saigon', 10.7798, 106.699, 'attraction');
reset role;
insert into trip_members (trip_id, user_id) values ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-00000000000b');

select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.refused($$insert into pins (trip_id, google_place_id, name, lat, lng, category) values ('66666666-6666-6666-6666-666666666666', 'gp-cathedral', 'Cathedral again', 10.7798, 106.699, 'attraction')$$,
  'the same place can''t be pinned twice on one trip');
insert into pins (trip_id, name, lat, lng, category) values ('66666666-6666-6666-6666-666666666666', 'My own spot', 10.78, 106.70, 'attraction');
insert into pins (trip_id, name, lat, lng, category) values ('66666666-6666-6666-6666-666666666666', 'Another own spot', 10.78, 106.70, 'attraction');
select test.ok((select count(*) from pins where google_place_id is null) = 2, 'pins without a Google place aren''t affected');
update pins set note = 'go early' where id = 'b1000000-0000-0000-0000-000000000001';
select test.ok((select note from pins where id = 'b1000000-0000-0000-0000-000000000001') = 'go early', 'editing a pin still works');

select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into pins (trip_id, google_place_id, name, lat, lng, category)
values ('77777777-7777-7777-7777-777777777777', 'gp-cathedral', 'Notre Dame Cathedral of Saigon', 10.7798, 106.699, 'attraction');
select test.ok((select count(*) from pins where google_place_id = 'gp-cathedral') = 2, 'the same place on a different trip is fine');
select test.refused($$update pins set trip_id = '66666666-6666-6666-6666-666666666666' where trip_id = '77777777-7777-7777-7777-777777777777' and google_place_id = 'gp-cathedral'$$,
  'moving a pin onto a trip that has that place is refused too');

select test.act_as('00000000-0000-0000-0000-00000000000c');
select test.ok(test.visible('select * from pins') = 0, 'a stranger still sees no pins');
