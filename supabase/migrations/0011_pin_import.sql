-- Hanh's Log's own database, part 11: the old-Wanderlog pin import queue (E71).
--
-- Hanh's old Wanderlog pins come over one place at a time (session 9). Claude
-- turns the export into a prepared file (real city, English : Local name,
-- category guess, MICHELIN check, merged copies); Hanh loads it once on
-- /wander/import, and each place waits here as 'pending' until Hanh saves it
-- (as a trip pin or a Savorlog eatery) or skips it for good. Progress lives in
-- the database so it follows Hanh to any device.
--
-- Private to the person who loaded it: nobody else can see or change the rows.
-- Only the Savorlog owner can load a file (the button shows only to them).
-- No DELETE: a skipped place stays as 'skipped' so reloading the file never
-- brings it back.
--
-- (M5.2b "forbid new food pins" moves to the next free number.)

create table if not exists public.pin_import_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  google_place_id text not null,
  city text not null,
  country text,
  lat double precision not null,
  lng double precision not null,
  -- The prepared add-card values (names, category path, MICHELIN, badges, note, why).
  prefill jsonb not null default '{}'::jsonb,
  -- The old pin(s) this place came from (trip, name, category, icon, note).
  copies jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'saved', 'skipped')),
  saved_pin_id uuid references public.pins(id) on delete set null,
  saved_eatery_id uuid references public.eateries(id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, google_place_id)
);
alter table public.pin_import_items enable row level security;
grant select, insert, update on table public.pin_import_items to authenticated;

create policy "you see your own import" on public.pin_import_items
  for select to authenticated
  using (owner_id = auth.uid());
create policy "the Savorlog owner loads an import" on public.pin_import_items
  for insert to authenticated
  with check (owner_id = auth.uid() and public.is_savorlog_owner(auth.uid()));
create policy "you work through your own import" on public.pin_import_items
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create index if not exists pin_import_items_owner_city on public.pin_import_items (owner_id, city);
