-- Hanh's Log's own database, part 21: Roaminglog's shared spot catalogue
-- (session 14, step 1 of the Roaminglog plan). Hanh decided (option B):
--   * every non-food place (accommodation, airport, attraction, shopping,
--     transport) becomes a "spot" in ONE shared, trip-independent catalogue,
--     like Savorlog's eateries; the section is Roaminglog, its page Spot List;
--   * the same people as Munch List see and edit spots: the family circle
--     and anyone on any trip (0015's rule);
--   * every trip's map shows all spots (the list follows the screen);
--   * removing a spot queues it for the Savorlog owner to confirm, as eateries.
-- Moving the existing trip pins in, and itinerary stops pointing at spots,
-- come in the next migration (0022).
-- allow-destructive: finalize_spot_deletion permanently removes one spot the
-- Savorlog owner confirms from the pending-deletion queue (approved by Hanh,
-- session 14, same as eateries); nothing else is removed.

-- 1. spots --------------------------------------------------------------------
create table if not exists public.spots (
  id uuid primary key default gen_random_uuid(),
  google_place_id text check (google_place_id is null or char_length(google_place_id) <= 300),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  address text check (address is null or char_length(address) <= 400),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  category text not null check (category in ('accommodation', 'airport', 'attraction', 'shopping', 'transport')),
  subcategory text check (subcategory is null or char_length(subcategory) <= 80),
  subsubcategory text check (subsubcategory is null or char_length(subsubcategory) <= 80),
  note text check (note is null or char_length(note) <= 4000),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  -- pending-deletion queue: set to hide everywhere until the owner finalizes.
  deleted_at timestamptz,
  deleted_by uuid
);
-- One row per real place (places without a Google id may repeat).
create unique index if not exists spots_place on public.spots (google_place_id) where google_place_id is not null;
alter table public.spots enable row level security;
-- No DELETE grant: a permanent delete happens only through the owner's
-- finalize function, never a raw statement.
grant select, insert, update on table public.spots to authenticated;

create policy "the circle and travelers see spots" on public.spots
  for select to authenticated
  using (
    (public.in_savorlog(auth.uid()) or public.on_any_trip())
    and (deleted_at is null or public.is_savorlog_owner(auth.uid()))
  );
create policy "the circle and travelers add spots" on public.spots
  for insert to authenticated
  with check (deleted_at is null and (public.in_savorlog(auth.uid()) or public.on_any_trip()));
create policy "the circle and travelers edit live spots" on public.spots
  for update to authenticated
  using (deleted_at is null and (public.in_savorlog(auth.uid()) or public.on_any_trip()))
  with check (deleted_at is null and (public.in_savorlog(auth.uid()) or public.on_any_trip()));

-- Can the current user see this spot (same rule as the SELECT policy)?
create or replace function public.spot_visible(_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from spots s
    where s.id = _id
      and (public.in_savorlog(auth.uid()) or public.on_any_trip())
      and (s.deleted_at is null or public.is_savorlog_owner(auth.uid()))
  )
$$;

-- Stage one: anyone who can see a live spot sends it to the queue.
create or replace function public.request_spot_deletion(_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from spots s
    where s.id = _id and s.deleted_at is null
      and (public.in_savorlog(auth.uid()) or public.on_any_trip())
  ) then
    raise exception 'not allowed: you can''t remove this spot';
  end if;
  update spots set deleted_at = now(), deleted_by = auth.uid() where id = _id;
end $$;

-- Stage two (owner only): restore a queued spot…
create or replace function public.restore_spot(_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_savorlog_owner(auth.uid()) then
    raise exception 'not allowed: only the owner finalizes deletions';
  end if;
  update spots set deleted_at = null, deleted_by = null where id = _id;
end $$;

-- …or confirm it, removing it for good (its reviews cascade away).
create or replace function public.finalize_spot_deletion(_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_savorlog_owner(auth.uid()) then
    raise exception 'not allowed: only the owner finalizes deletions';
  end if;
  delete from spots where id = _id and deleted_at is not null;
end $$;

revoke all on function public.spot_visible(uuid) from public, anon;
revoke all on function public.request_spot_deletion(uuid) from public, anon;
revoke all on function public.restore_spot(uuid) from public, anon;
revoke all on function public.finalize_spot_deletion(uuid) from public, anon;
grant execute on function public.spot_visible(uuid) to authenticated;
grant execute on function public.request_spot_deletion(uuid) to authenticated;
grant execute on function public.restore_spot(uuid) to authenticated;
grant execute on function public.finalize_spot_deletion(uuid) to authenticated;

-- 2. spot_reviews -------------------------------------------------------------
-- Each person's own WTG / VIS for a spot, exactly like eatery_reviews.
create table if not exists public.spot_reviews (
  spot_id uuid not null references public.spots (id) on delete cascade,
  user_id uuid not null default auth.uid(),
  status text not null check (status in ('wtg', 'vis')),
  verdict text check (verdict in ('revisit', 'second', 'no')),
  rating numeric(2, 1) check (rating between 1 and 5 and rating * 2 = trunc(rating * 2)),
  updated_at timestamptz not null default now(),
  primary key (spot_id, user_id),
  check ((status = 'vis') = (verdict is not null)),
  check (status = 'vis' or rating is null)
);
alter table public.spot_reviews enable row level security;
grant select, insert, update, delete on table public.spot_reviews to authenticated;
create policy "people who see a spot see its reviews" on public.spot_reviews
  for select to authenticated
  using (public.spot_visible(spot_id));
create policy "people set their own spot review" on public.spot_reviews
  for insert to authenticated
  with check (user_id = auth.uid() and public.spot_visible(spot_id));
create policy "people change their own spot review" on public.spot_reviews
  for update to authenticated
  using (user_id = auth.uid() and public.spot_visible(spot_id))
  with check (user_id = auth.uid() and public.spot_visible(spot_id));
create policy "people clear their own spot review" on public.spot_reviews
  for delete to authenticated
  using (user_id = auth.uid() and public.spot_visible(spot_id));

create trigger spot_reviews_touch before update on public.spot_reviews
  for each row execute function public.pin_reviews_touch();
