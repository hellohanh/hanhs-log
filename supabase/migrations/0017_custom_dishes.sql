-- Hanh's Log's own database, part 17: your own main dishes (session 14).
-- Hanh decided:
--   * the Main dish menu gets "+ Add a new dish…"; a typed dish joins that
--     cuisine's list only (Fusion, which had no list, can collect dishes too);
--   * everyone who sees the Savorlog catalogue (the family circle and anyone
--     on a trip, 0015) sees and can add dishes;
--   * add only for now: no renaming or removing.
-- An eatery stores the dish's key in eateries.dish, as with the built-in
-- dishes; added keys start with "x-" so they never clash with built-in ones.

create table if not exists public.custom_dishes (
  id uuid primary key default gen_random_uuid(),
  cuisine text not null check (char_length(cuisine) between 1 and 80),
  key text not null check (key ~ '^x-[a-z0-9-]{1,76}$'),
  label text not null check (char_length(btrim(label)) between 1 and 80),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (cuisine, key)
);
alter table public.custom_dishes enable row level security;
-- Add only: no UPDATE or DELETE grant.
grant select, insert on table public.custom_dishes to authenticated;
create policy "catalogue people see added dishes" on public.custom_dishes
  for select to authenticated
  using (public.in_savorlog(auth.uid()) or public.on_any_trip());
create policy "catalogue people add dishes as themselves" on public.custom_dishes
  for insert to authenticated
  with check (created_by = auth.uid() and (public.in_savorlog(auth.uid()) or public.on_any_trip()));
