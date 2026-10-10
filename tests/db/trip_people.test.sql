-- Migration 0001 (who is on a trip): first names, the people list, the
-- owner removing someone and resetting the invite link, and the guard that
-- stops members changing a trip's owner or invite link.
-- Cast: owner A, stranger B, guest C (joined by link, no email), member D.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'stranger@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true),
  ('00000000-0000-0000-0000-00000000000d', 'member@test.local', false);

-- ===== Setup: A makes a trip, C and D join by link =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into trips (id, name, destination, owner_id, invite_token)
values ('11111111-1111-1111-1111-111111111111', 'Saigon test', 'Ho Chi Minh City',
        '00000000-0000-0000-0000-00000000000a', '99999999-9999-9999-9999-999999999999');
insert into profiles (display_name) values ('Hanh');

select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select join_trip_via_invite('99999999-9999-9999-9999-999999999999');
insert into profiles (display_name) values ('Mai');

select test.act_as('00000000-0000-0000-0000-00000000000d');
select join_trip_via_invite('99999999-9999-9999-9999-999999999999');
insert into profiles (display_name) values ('Tuấn');

select test.act_as('00000000-0000-0000-0000-00000000000b');
insert into profiles (display_name) values ('Stranger');

-- ===== First names (profiles) =====
select test.ok(test.visible('select * from profiles') = 1, 'a person sees only their own profile row');
select test.refused($$insert into profiles (user_id, display_name) values ('00000000-0000-0000-0000-00000000000d', 'Fake')$$,
  'nobody can create a profile for someone else');
update profiles set display_name = 'Hacked' where user_id = '00000000-0000-0000-0000-00000000000a';
select test.refused($$insert into profiles (display_name) values ('   ')$$,
  'a blank first name is refused');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok((select display_name from profiles) = 'Hanh', 'a stranger''s edit to someone else''s name had no effect');
update profiles set display_name = 'Hanh T.';
select test.ok((select display_name from profiles) = 'Hanh T.', 'people can change their own first name');

-- ===== The people list =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select test.ok((select count(*) from trip_people('11111111-1111-1111-1111-111111111111')) = 3,
  'a guest who joined by link sees all 3 people on the trip');
select test.ok((select string_agg(display_name, ',' order by is_owner desc, display_name)
                from trip_people('11111111-1111-1111-1111-111111111111')) = 'Hanh T.,Mai,Tuấn',
  'the list shows first names, owner first');
select test.ok((select is_owner from trip_people('11111111-1111-1111-1111-111111111111') where display_name = 'Hanh T.'),
  'the owner is marked as owner');
select test.ok((select is_me from trip_people('11111111-1111-1111-1111-111111111111') where display_name = 'Mai'),
  'the person asking is marked as "you"');
select test.ok((select joined_at is not null from trip_people('11111111-1111-1111-1111-111111111111') where display_name = 'Tuấn'),
  'people who join now get a joined date');
select test.ok((select people from trip_people_counts() where trip_id = '11111111-1111-1111-1111-111111111111') = 3,
  'a member sees the trip''s people count');

select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.refused($$select * from trip_people('11111111-1111-1111-1111-111111111111')$$,
  'a stranger cannot see who is on the trip');
select test.ok(test.visible('select * from trip_people_counts()') = 0, 'a stranger gets no people counts');

select test.act_as(null);
select test.refused($$select * from trip_people('11111111-1111-1111-1111-111111111111')$$,
  'a signed-out visitor cannot see who is on the trip');
select test.refused($$select reset_trip_invite('11111111-1111-1111-1111-111111111111')$$,
  'a signed-out visitor cannot reset the invite link');

-- ===== Members cannot change the owner or the invite link =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select test.refused($$update trips set invite_token = '77777777-7777-7777-7777-777777777777' where id = '11111111-1111-1111-1111-111111111111'$$,
  'a member cannot change the invite link by editing the trip');
select test.refused($$update trips set owner_id = '00000000-0000-0000-0000-00000000000c' where id = '11111111-1111-1111-1111-111111111111'$$,
  'a member cannot make themselves the owner');
select test.refused($$select reset_trip_invite('11111111-1111-1111-1111-111111111111')$$,
  'a member cannot reset the invite link');
update trips set name = 'Saigon trip' where id = '11111111-1111-1111-1111-111111111111';
select test.ok((select name from trips where id = '11111111-1111-1111-1111-111111111111') = 'Saigon trip',
  'members can still edit the trip''s name (as in Wanderlog)');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.refused($$update trips set owner_id = '00000000-0000-0000-0000-00000000000d' where id = '11111111-1111-1111-1111-111111111111'$$,
  'not even the owner can hand the trip to someone else from the app');

-- ===== Removing someone =====
select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.refused($$select remove_trip_member('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000c')$$,
  'a member cannot remove another member');
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.refused($$select remove_trip_member('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000c')$$,
  'a stranger cannot remove a member');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.refused($$select remove_trip_member('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a')$$,
  'the owner cannot remove themselves');
select remove_trip_member('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000d');
select test.ok((select count(*) from trip_people('11111111-1111-1111-1111-111111111111')) = 2,
  'the owner can remove a member');

select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.ok(test.visible('select * from trips') = 0, 'a removed member can no longer see the trip');

-- ===== Resetting the invite link =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.ok(reset_trip_invite('11111111-1111-1111-1111-111111111111') <> '99999999-9999-9999-9999-999999999999',
  'the owner can reset the invite link');

select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.refused($$select join_trip_via_invite('99999999-9999-9999-9999-999999999999')$$,
  'the old invite link stops working after a reset');

select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select test.ok(test.visible('select * from trips') = 1, 'people already on the trip keep access after a reset');
