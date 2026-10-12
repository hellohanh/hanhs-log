-- Hanh's Log's own database, part 9: the Savorlog circle's invite (M4 step 4e).
--
-- The one Savorlog circle (savorlog_members, 0007) gets its own invite link,
-- separate from any trip. Signed-in family join by the link and become members
-- who can add / edit the whole catalogue; anonymous trip-style guests cannot
-- join the circle (Hanh, session 6). The owner can reset the link and remove
-- members; the owner can't be removed and ownership doesn't transfer. Mirrors
-- the trip sharing functions (0001).
--
-- allow-destructive: remove_savorlog_member deletes one membership row when the
-- owner removes someone (feature approved by Hanh, session 6); nothing else.

-- The circle's single settings row: its invite token.
create table if not exists public.savorlog (
  id boolean primary key default true check (id),
  invite_token uuid not null default gen_random_uuid()
);
alter table public.savorlog enable row level security;
grant select on table public.savorlog to authenticated;
create policy "the circle sees its invite" on public.savorlog
  for select to authenticated using (public.in_savorlog(auth.uid()));

-- The invite link for a circle member to share (makes the row on first use).
create or replace function public.savorlog_invite()
returns uuid
language plpgsql security definer set search_path = public as $$
declare _token uuid;
begin
  if not public.in_savorlog(auth.uid()) then
    raise exception 'not allowed: only the Savorlog circle can share its invite';
  end if;
  insert into savorlog (id) values (true) on conflict (id) do nothing;
  select invite_token into _token from savorlog where id;
  return _token;
end $$;
revoke all on function public.savorlog_invite() from public, anon;
grant execute on function public.savorlog_invite() to authenticated;

-- Join the circle by its invite link — signed-in family only, never guests.
create or replace function public.join_savorlog_via_invite(_token uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  _anon boolean := coalesce((current_setting('request.jwt.claims', true)::json ->> 'is_anonymous')::boolean, false);
begin
  if auth.uid() is null or _anon then
    raise exception 'not allowed: sign in with an account first';
  end if;
  if not exists (select 1 from savorlog where id and invite_token = _token) then
    raise exception 'invalid invite token';
  end if;
  insert into savorlog_members (user_id, role) values (auth.uid(), 'member')
  on conflict (user_id) do nothing;
end $$;
revoke all on function public.join_savorlog_via_invite(uuid) from public, anon;
grant execute on function public.join_savorlog_via_invite(uuid) to authenticated;

-- Everyone in the circle (owner first), with first names. Members only.
create or replace function public.savorlog_people()
returns table (user_id uuid, display_name text, is_owner boolean, is_me boolean, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.in_savorlog(auth.uid()) then
    raise exception 'not allowed: you are not in the Savorlog circle';
  end if;
  return query
    select m.user_id, pr.display_name, m.role = 'owner', m.user_id = auth.uid(), m.joined_at
    from savorlog_members m
    left join profiles pr on pr.user_id = m.user_id
    order by (m.role = 'owner') desc, m.joined_at nulls first, pr.display_name;
end $$;
revoke all on function public.savorlog_people() from public, anon;
grant execute on function public.savorlog_people() to authenticated;

create or replace function public.remove_savorlog_member(_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_savorlog_owner(auth.uid()) then
    raise exception 'not allowed: only the owner can remove people';
  end if;
  if _user = auth.uid() then
    raise exception 'the owner cannot remove themselves';
  end if;
  delete from savorlog_members m where m.user_id = _user and m.role <> 'owner';
end $$;
revoke all on function public.remove_savorlog_member(uuid) from public, anon;
grant execute on function public.remove_savorlog_member(uuid) to authenticated;

create or replace function public.reset_savorlog_invite()
returns uuid
language plpgsql security definer set search_path = public as $$
declare _token uuid;
begin
  if not public.is_savorlog_owner(auth.uid()) then
    raise exception 'not allowed: only the owner can reset the invite link';
  end if;
  insert into savorlog (id) values (true) on conflict (id) do nothing;
  update savorlog set invite_token = gen_random_uuid() where id returning invite_token into _token;
  return _token;
end $$;
revoke all on function public.reset_savorlog_invite() from public, anon;
grant execute on function public.reset_savorlog_invite() to authenticated;
