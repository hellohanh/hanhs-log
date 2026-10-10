-- Milestone 3, step 3: the trip's city (approved by Hanh, session 4).
--
-- The trip map opens on the first city named in the trip's Destination,
-- showing the whole city. The app looks the city up once (Google Places)
-- when the trip is created or its Destination changes, and saves it here,
-- so every later open starts in the right place without another lookup.
--
--   city_query            the city name that was looked up (e.g. "Ho Chi Minh City");
--                         if the Destination changes (in Hanh's Log or the old
--                         Wanderlog), the app sees it no longer matches and looks again
--   city_lat, city_lng    the city's centre
--   city_north/south/east/west   the city's outline box, used to fit the whole city
--
-- All columns are empty to start and optional. Live Wanderlog ignores them.
-- Who may change them follows the existing "trip members can edit trips"
-- rule (owner and members), unchanged.

alter table public.trips
  add column if not exists city_query text,
  add column if not exists city_lat double precision,
  add column if not exists city_lng double precision,
  add column if not exists city_north double precision,
  add column if not exists city_south double precision,
  add column if not exists city_east double precision,
  add column if not exists city_west double precision;
