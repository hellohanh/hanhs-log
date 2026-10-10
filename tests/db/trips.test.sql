-- Hanh's Log's own database (migration 0001): trips, the people on them,
-- joining by link, owner-only actions and the owner/invite guard.
-- Cast: owner A, stranger B, guest C (joined by link, no email), member D.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true),
  ('00000000-0000-0000-0000-00000000000d', 'member@test.local', false);

-- ===== Creating a trip =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, country, city_primary, city_secondary, invite_token)
values ('11111111-1111-1111-1111-111111111111', '2026 Holiday Trip; Saigon Leg', 'Vietnam', 'Hồ Chí Minh City', 'Cần Giờ',
        '99999999-9999-9999-9999-999999999999');
select test.ok((select owner_id from trips) = '00000000-0000-0000-0000-00000000000a', 'a new trip belongs to whoever made it');
select test.refused($$insert into trips (name, country, city_primary) values ('No country', '  ', 'Rome')$$,
  'a trip needs a Country');
select test.refused($$insert into trips (name, country) values ('No city', 'Italy')$$,
  'a trip needs a Primary City');
select test.refused($$insert into trips (name, country, city_primary, start_date, end_date) values ('Backwards', 'Italy', 'Rome', '2027-03-16', '2027-03-12')$$,
  'the end date can''t be before the start date');
select test.refused($$insert into trips (name, country, city_primary, owner_id) values ('For someone else', 'Italy', 'Rome', '00000000-0000-0000-0000-00000000000b')$$,
  'nobody can create a trip owned by someone else');
insert into profiles (display_name) values ('Hanh');

-- ===== Strangers and signed-out visitors =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
insert into profiles (display_name) values ('Stranger');
select test.ok(test.visible('select * from trips') = 0, 'a stranger sees no trips');
select test.ok(test.visible('select * from trip_members') = 0, 'a stranger sees no members');
update trips set name = 'Hacked' where id = '11111111-1111-1111-1111-111111111111';
delete from trips where id = '11111111-1111-1111-1111-111111111111';
select test.refused($$select * from trip_people('11111111-1111-1111-1111-111111111111')$$, 'a stranger can''t list the people on a trip');
select test.ok((select count(*) from trip_people_counts()) = 0, 'a stranger gets no people counts');
select test.refused($$select reset_trip_invite('11111111-1111-1111-1111-111111111111')$$, 'a stranger can''t reset the invite link');

select test.act_as(null);
select test.ok(test.visible('select * from trips') = 0, 'a signed-out visitor sees no trips');
select test.refused($$select join_trip_via_invite('99999999-9999-9999-9999-999999999999')$$, 'a signed-out visitor can''t join by link');
select test.refused($$insert into trips (name, country, city_primary) values ('x', 'Italy', 'Rome')$$, 'a signed-out visitor can''t create a trip');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok((select name from trips where id = '11111111-1111-1111-1111-111111111111') = '2026 Holiday Trip; Saigon Leg',
  'the stranger''s edit and delete had no effect');

-- ===== Joining by link =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select test.refused($$select join_trip_via_invite('00000000-0000-0000-0000-000000000000')$$, 'a wrong invite code is refused');
select test.ok(join_trip_via_invite('99999999-9999-9999-9999-999999999999') = '11111111-1111-1111-1111-111111111111',
  'a guest (no email) joins by link');
select join_trip_via_invite('99999999-9999-9999-9999-999999999999');
select test.ok(test.visible('select * from trip_members') = 1, 'joining twice is harmless');
insert into profiles (display_name) values ('Mai');
select test.ok(test.visible('select * from trips') = 1, 'the guest now sees the trip');
update trips set city_tertiary = 'Vũng Tàu', map_query = 'Hồ Chí Minh City, Vietnam', map_lat = 10.7769, map_lng = 106.7009
  where id = '11111111-1111-1111-1111-111111111111';
select test.ok((select city_tertiary from trips) = 'Vũng Tàu', 'a member can edit the trip, including where the map opens');
select test.refused($$update trips set owner_id = '00000000-0000-0000-0000-00000000000c' where id = '11111111-1111-1111-1111-111111111111'$$,
  'a member can''t take over the trip');
select test.refused($$update trips set invite_token = gen_random_uuid() where id = '11111111-1111-1111-1111-111111111111'$$,
  'a member can''t change the invite link');
delete from trips where id = '11111111-1111-1111-1111-111111111111';
select test.ok(test.visible('select * from trips') = 1, 'a member can''t delete the trip');

select test.act_as('00000000-0000-0000-0000-00000000000d');
select join_trip_via_invite('99999999-9999-9999-9999-999999999999');
insert into profiles (display_name) values ('Tuấn');

-- ===== The people list =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select test.ok((select string_agg(display_name, ',' order by is_owner desc, display_name)
                from trip_people('11111111-1111-1111-1111-111111111111')) = 'Hanh,Mai,Tuấn',
  'people on the trip see first names, owner first');
select test.ok((select is_me from trip_people('11111111-1111-1111-1111-111111111111') where display_name = 'Mai'),
  'the person asking is marked as "you"');
select test.ok((select people from trip_people_counts() where trip_id = '11111111-1111-1111-1111-111111111111') = 3,
  'the people count includes the owner');
select test.ok(test.visible('select * from profiles') = 1, 'profiles stay private: each person reads only their own');

-- ===== Owner actions =====
select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.refused($$select remove_trip_member('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000c')$$,
  'a member can''t remove someone');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select remove_trip_member('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from trip_people('11111111-1111-1111-1111-111111111111')) = 2, 'the owner can remove someone');
select test.refused($$select remove_trip_member('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a')$$,
  'the owner can''t remove themselves');
select test.ok(reset_trip_invite('11111111-1111-1111-1111-111111111111') <> '99999999-9999-9999-9999-999999999999',
  'the owner can reset the invite link');

select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.ok(test.visible('select * from trips') = 0, 'someone removed no longer sees the trip');
select test.refused($$select join_trip_via_invite('99999999-9999-9999-9999-999999999999')$$, 'the old invite link stops working');

select test.act_as('00000000-0000-0000-0000-00000000000a');
delete from trips where id = '11111111-1111-1111-1111-111111111111';
select test.ok(test.visible('select * from trips') = 0, 'the owner can delete the trip');
