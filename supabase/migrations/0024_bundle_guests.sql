-- Hanh's Log's own database, part 24: the several-trips link works without
-- an email, like a single trip's link (session 15, Hanh). Family members were
-- sent to sign in by email, the email link opened in another browser (or
-- landed on the home page), and they never joined. Now anyone with the link
-- taps "Join all": guests are signed in without an email (as with a trip's
-- own link) and asked for a first name. Making and stopping links is still
-- for signed-in owners only; a stopped link still works for nobody.

-- What a link invites to: anyone signed in, guests included.
create or replace function public.trip_bundle_preview(_token uuid)
returns table (trip_id uuid, name text, start_date date, end_date date, from_name text, already boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not allowed: sign in first'; end if;
  return query
    select t.id, t.name, t.start_date, t.end_date, p.display_name,
           (t.owner_id = auth.uid() or exists (select 1 from trip_members m where m.trip_id = t.id and m.user_id = auth.uid()))
    from trip_bundles b
    join trips t on t.id = any (b.trip_ids) and t.owner_id = b.owner_id
    left join profiles p on p.user_id = b.owner_id
    where b.token = _token and b.stopped_at is null
    order by t.start_date nulls last, t.name;
end $$;

-- Join every trip on the link: anyone signed in, guests included.
create or replace function public.join_trips_via_bundle(_token uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare
  _b trip_bundles;
  _n int;
begin
  if auth.uid() is null then raise exception 'not allowed: sign in first'; end if;
  select * into _b from trip_bundles where token = _token and stopped_at is null;
  if _b.id is null then raise exception 'invalid or stopped invite link'; end if;
  insert into trip_members (trip_id, user_id)
    select t.id, auth.uid() from trips t
    where t.id = any (_b.trip_ids) and t.owner_id = _b.owner_id and t.owner_id <> auth.uid()
  on conflict (trip_id, user_id) do nothing;
  get diagnostics _n = row_count;
  return _n;
end $$;

revoke all on function public.trip_bundle_preview(uuid) from public, anon;
revoke all on function public.join_trips_via_bundle(uuid) from public, anon;
grant execute on function public.trip_bundle_preview(uuid) to authenticated;
grant execute on function public.join_trips_via_bundle(uuid) to authenticated;
