-- Hanh's Log's own database, part 23: when each shared row last changed, and
-- by whom (session 15, offline step 3). A change made offline is sent later;
-- if someone else changed the same thing meanwhile, the app asks which one
-- stays (Hanh's choice, approved mockup screen 3). To tell, it needs each
-- row's last-change time and person. Add-only: two columns per table, filled
-- in by the database itself (nobody can set them by hand).

create or replace function public.touch_row()
returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['trips', 'itinerary_days', 'travel_legs', 'itinerary_activities', 'itinerary_stops', 'pins', 'spots', 'eateries']
  loop
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('alter table public.%I add column if not exists updated_by uuid', t);
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.touch_row()', t || '_touch', t);
  end loop;
end
$$;
