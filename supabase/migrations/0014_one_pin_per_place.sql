-- Hanh's Log's own database, part 14: one pin per Google place per trip
-- (Hanh, session 10: "block it"). The same place can't be pinned twice on
-- one trip; the same place on two different trips is fine. Savorlog
-- eateries already allow each place once (0007, eateries_place).
-- (M5.2b "forbid new food pins" moves to the next free number, 0015.)
--
-- A rule on new and changed pins only: any duplicates already saved stay as
-- they are (nothing is deleted), so this can't fail on existing data.

create or replace function public.pins_one_per_place()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.google_place_id is not null and exists (
    select 1 from pins p
     where p.trip_id = new.trip_id
       and p.google_place_id = new.google_place_id
       and p.id <> new.id
  ) then
    raise exception 'That place is already pinned on this trip.' using errcode = '23505';
  end if;
  return new;
end $$;
revoke all on function public.pins_one_per_place() from public, anon;

drop trigger if exists pins_one_per_place on public.pins;
create trigger pins_one_per_place
  before insert or update of trip_id, google_place_id on public.pins
  for each row execute function public.pins_one_per_place();
