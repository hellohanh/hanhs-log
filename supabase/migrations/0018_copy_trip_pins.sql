-- Hanh's Log's own database, part 18: copy all pins from one trip to another
-- (session 14, e.g. Tokyo Homebound → Tokyo Outbound). Hanh decided:
--   * one "Copy all" copies every pin of the other trip; a place already
--     pinned on the receiving trip (same Google place) is skipped;
--   * a copied pin brings everything: category, MICHELIN, Vibe ticks, note,
--     and everyone's WTG / VIS status and rating;
--   * anyone who is on BOTH trips can copy; the original trip is unchanged.
-- Copying other people's reviews needs security definer; the function checks
-- the caller is on both trips first. Eateries aren't copied: every trip
-- already shows the whole catalogue (0015).

create or replace function public.copy_trip_pins(_from uuid, _to uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare
  p record;
  new_id uuid;
  copied int := 0;
  skipped int := 0;
begin
  if _from = _to then raise exception 'Pick a different trip to copy from.'; end if;
  if not (public.is_on_trip(_from) and public.is_on_trip(_to)) then
    raise exception 'You can copy pins only between trips you are on.';
  end if;
  for p in select * from pins where trip_id = _from order by created_at loop
    if p.google_place_id is not null
       and exists (select 1 from pins x where x.trip_id = _to and x.google_place_id = p.google_place_id) then
      skipped := skipped + 1;
      continue;
    end if;
    insert into pins (trip_id, google_place_id, name, address, lat, lng, category, subcategory, subsubcategory,
                      michelin, michelin_year, street_food, fine_dining, dine_in, food_truck, outdoor_seating,
                      community_seating, food_court, counter_seating, takeaway, note, created_by)
    values (_to, p.google_place_id, p.name, p.address, p.lat, p.lng, p.category, p.subcategory, p.subsubcategory,
            p.michelin, p.michelin_year, p.street_food, p.fine_dining, p.dine_in, p.food_truck, p.outdoor_seating,
            p.community_seating, p.food_court, p.counter_seating, p.takeaway, p.note, auth.uid())
    returning id into new_id;
    insert into pin_reviews (pin_id, user_id, status, verdict, rating, updated_at)
      select new_id, r.user_id, r.status, r.verdict, r.rating, r.updated_at from pin_reviews r where r.pin_id = p.id;
    copied := copied + 1;
  end loop;
  return json_build_object('copied', copied, 'skipped', skipped);
end $$;
revoke all on function public.copy_trip_pins(uuid, uuid) from public, anon;
grant execute on function public.copy_trip_pins(uuid, uuid) to authenticated;
