-- Hanh's Log's own database, part 8: eatery photos (Savorlog, M4 step 4d).
--
-- Up to 3 photos per eatery, uploaded by anyone who can see it and shared on
-- the eatery (E61). Each row records the uploaded file's path in the
-- "eatery-photos" Storage bucket; the first by sort is the cover. When there
-- are no uploads the app falls back to a Google place photo, then to a
-- "Photo coming soon" placeholder (E67). The image bytes live in Storage (a
-- public bucket set up once in the dashboard, docs/database.md); this table is
-- the metadata, gated by the same visibility rule as the eatery.

create table if not exists public.eatery_photos (
  id uuid primary key default gen_random_uuid(),
  eatery_id uuid not null references public.eateries (id) on delete cascade,
  path text not null check (char_length(path) between 1 and 400),
  sort smallint not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists eatery_photos_eatery on public.eatery_photos (eatery_id);
alter table public.eatery_photos enable row level security;
grant select, insert, delete on table public.eatery_photos to authenticated;

-- See a photo if you can see its eatery; add your own; anyone who can see it
-- may remove one (photos are shared, like the eatery itself).
create policy "people who see an eatery see its photos" on public.eatery_photos
  for select to authenticated
  using (public.eatery_visible(eatery_id));
create policy "people add photos to an eatery they can see" on public.eatery_photos
  for insert to authenticated
  with check (created_by = auth.uid() and public.eatery_visible(eatery_id));
create policy "people remove photos from an eatery they can see" on public.eatery_photos
  for delete to authenticated
  using (public.eatery_visible(eatery_id));
