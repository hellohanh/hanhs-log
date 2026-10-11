-- Migration 0009 (the Savorlog circle's invite + join / people / remove / reset).
-- Cast: A owns the circle; B is signed-in family; C is an anonymous guest; D a stranger.

insert into auth.users (id, email, is_anonymous) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.local', false),
  ('00000000-0000-0000-0000-00000000000b', 'family@test.local', false),
  ('00000000-0000-0000-0000-00000000000c', null, true),
  ('00000000-0000-0000-0000-00000000000d', 'stranger@test.local', false);
insert into profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'Hanh'),
  ('00000000-0000-0000-0000-00000000000b', 'Mai');

-- ===== A claims the circle and gets an invite =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
select claim_savorlog();
select test.ok(savorlog_invite() is not null, 'the owner gets an invite link');

-- ===== C (anonymous guest) can't join the circle =====
select test.act_as('00000000-0000-0000-0000-00000000000c', true);
select test.refused($$select join_savorlog_via_invite((select invite_token from savorlog where id))$$,
  'an anonymous guest can''t join the circle');

-- ===== D (stranger) with a wrong token is refused =====
select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.refused($$select join_savorlog_via_invite('00000000-0000-0000-0000-000000000000')$$,
  'a wrong invite token is refused');

-- ===== B (signed-in family) joins =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.refused($$select savorlog_people()$$, 'a non-member can''t list the circle');
-- Join needs the real token; read it as the owner would share it.
select test.act_as('00000000-0000-0000-0000-00000000000a');
select set_config('test.token', (select invite_token from savorlog where id)::text, false);
select test.act_as('00000000-0000-0000-0000-00000000000b');
select join_savorlog_via_invite(current_setting('test.token')::uuid);
select test.ok(test.visible('select * from savorlog_members') = 2, 'family joins the circle');
select test.ok((select count(*) from savorlog_people()) = 2, 'and shows in the people list');
select test.refused($$select remove_savorlog_member('00000000-0000-0000-0000-00000000000a')$$,
  'a member can''t remove anyone');
select test.refused($$select reset_savorlog_invite()$$, 'a member can''t reset the link');

-- ===== Owner removes B and resets the link =====
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.refused($$select remove_savorlog_member('00000000-0000-0000-0000-00000000000a')$$,
  'the owner can''t remove themselves');
select set_config('test.old', (select invite_token from savorlog where id)::text, false);
select reset_savorlog_invite();
select test.ok((select invite_token from savorlog where id)::text <> current_setting('test.old'), 'the owner resets the link');
select remove_savorlog_member('00000000-0000-0000-0000-00000000000b');
select test.ok(test.visible('select * from savorlog_members') = 1, 'the owner removes a member');

-- ===== The old link no longer works =====
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.refused($$select join_savorlog_via_invite(current_setting('test.old')::uuid)$$,
  'the old invite link stops working');
