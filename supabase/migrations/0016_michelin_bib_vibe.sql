-- Hanh's Log's own database, part 16: MICHELIN Bib Gourmand and the Vibe ticks
-- (session 14). Hanh decided:
--   * MICHELIN levels are None / Selected / Bib / 1-3 stars. "Selected" is the
--     old "mentioned" value, renamed only in the app (saved rows unchanged);
--     Bib Gourmand is a new value, 'bib' (updates E52, which had no Bib box);
--   * the old Street food / Fine dining ticks become a standalone "Vibe" set
--     where any number can be ticked together: Dine in, Fine dining, Street
--     food, Food truck, Outdoor seating, Community seating, Food court /
--     hawker, Counter / bar seating, Takeaway / to-go. street_food and
--     fine_dining keep their columns and saved values; seven columns are new.
-- Like MICHELIN, the Vibe ticks are for food and drink pins only. No table or
-- access changes; existing rows all stay valid.

-- 1. 'bib' joins the allowed MICHELIN values on pins and eateries. -------------
-- The old checks were unnamed column checks; find them by what they test.
do $$
declare c record;
begin
  for c in
    select conrelid::regclass::text as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.pins'::regclass, 'public.eateries'::regclass)
      and pg_get_constraintdef(oid) like '%michelin%'
      and pg_get_constraintdef(oid) like '%mentioned%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;
alter table public.pins add constraint pins_michelin_level
  check (michelin in ('mentioned', 'bib', '1', '2', '3'));
alter table public.eateries add constraint eateries_michelin_level
  check (michelin in ('mentioned', 'bib', '1', '2', '3'));

-- 2. The seven new Vibe ticks. --------------------------------------------------
alter table public.pins
  add column if not exists dine_in boolean not null default false,
  add column if not exists food_truck boolean not null default false,
  add column if not exists outdoor_seating boolean not null default false,
  add column if not exists community_seating boolean not null default false,
  add column if not exists food_court boolean not null default false,
  add column if not exists counter_seating boolean not null default false,
  add column if not exists takeaway boolean not null default false;
alter table public.eateries
  add column if not exists dine_in boolean not null default false,
  add column if not exists food_truck boolean not null default false,
  add column if not exists outdoor_seating boolean not null default false,
  add column if not exists community_seating boolean not null default false,
  add column if not exists food_court boolean not null default false,
  add column if not exists counter_seating boolean not null default false,
  add column if not exists takeaway boolean not null default false;

-- 3. MICHELIN and every Vibe tick stay food-and-drink-only on pins. ------------
-- Replaces 0004's unnamed "category = 'food' or (…)" check.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where contype = 'c' and conrelid = 'public.pins'::regclass
      and pg_get_constraintdef(oid) like '%category%'
      and pg_get_constraintdef(oid) like '%street_food%'
  loop
    execute format('alter table public.pins drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.pins add constraint pins_food_only_extras
  check (category = 'food' or (
    michelin is null and not street_food and not fine_dining and not dine_in
    and not food_truck and not outdoor_seating and not community_seating
    and not food_court and not counter_seating and not takeaway));
