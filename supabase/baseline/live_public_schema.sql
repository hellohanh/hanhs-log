--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Ubuntu 17.11-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: join_trip_via_invite(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_trip_via_invite(_token uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  _trip_id uuid;
begin
  select id into _trip_id from trips where invite_token = _token;

  if _trip_id is null then
    raise exception 'invalid invite token';
  end if;

  insert into trip_members (trip_id, user_id)
  values (_trip_id, auth.uid())
  on conflict (trip_id, user_id) do nothing;

  return _trip_id;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: itinerary_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itinerary_days (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid,
    day_number integer NOT NULL,
    date date,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: itinerary_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itinerary_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    itinerary_day_id uuid,
    content text NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: itinerary_stops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itinerary_stops (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    itinerary_day_id uuid,
    pin_id uuid,
    order_index integer DEFAULT 0 NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    created_at timestamp with time zone DEFAULT now(),
    notes text
);


--
-- Name: pins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trip_id uuid,
    name text NOT NULL,
    category text DEFAULT 'attraction'::text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    notes text,
    place_id text,
    added_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    icon text,
    CONSTRAINT pins_category_check CHECK ((category = ANY (ARRAY['attraction'::text, 'dining'::text, 'accommodation'::text, 'airport'::text, 'transport'::text, 'shopping'::text, 'cafe'::text, 'bakery'::text])))
);


--
-- Name: travel_legs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.travel_legs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    itinerary_day_id uuid,
    mode text NOT NULL,
    carrier text,
    reference text,
    from_location text NOT NULL,
    from_time time without time zone,
    to_location text NOT NULL,
    to_time time without time zone,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    title text,
    from_date date,
    to_date date,
    from_timezone text,
    to_timezone text,
    CONSTRAINT travel_legs_mode_check CHECK ((mode = ANY (ARRAY['flight'::text, 'train'::text, 'bus'::text, 'personal'::text])))
);


--
-- Name: trip_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trip_members (
    trip_id uuid NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: trips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    destination text NOT NULL,
    start_date date,
    end_date date,
    owner_id uuid,
    invite_token uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: itinerary_days itinerary_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_days
    ADD CONSTRAINT itinerary_days_pkey PRIMARY KEY (id);


--
-- Name: itinerary_days itinerary_days_trip_id_day_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_days
    ADD CONSTRAINT itinerary_days_trip_id_day_number_key UNIQUE (trip_id, day_number);


--
-- Name: itinerary_notes itinerary_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_notes
    ADD CONSTRAINT itinerary_notes_pkey PRIMARY KEY (id);


--
-- Name: itinerary_stops itinerary_stops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_stops
    ADD CONSTRAINT itinerary_stops_pkey PRIMARY KEY (id);


--
-- Name: pins pins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pins
    ADD CONSTRAINT pins_pkey PRIMARY KEY (id);


--
-- Name: travel_legs travel_legs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_legs
    ADD CONSTRAINT travel_legs_pkey PRIMARY KEY (id);


--
-- Name: trip_members trip_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_members
    ADD CONSTRAINT trip_members_pkey PRIMARY KEY (trip_id, user_id);


--
-- Name: trips trips_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_invite_token_key UNIQUE (invite_token);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: itinerary_days itinerary_days_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_days
    ADD CONSTRAINT itinerary_days_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: itinerary_notes itinerary_notes_itinerary_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_notes
    ADD CONSTRAINT itinerary_notes_itinerary_day_id_fkey FOREIGN KEY (itinerary_day_id) REFERENCES public.itinerary_days(id) ON DELETE CASCADE;


--
-- Name: itinerary_stops itinerary_stops_itinerary_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_stops
    ADD CONSTRAINT itinerary_stops_itinerary_day_id_fkey FOREIGN KEY (itinerary_day_id) REFERENCES public.itinerary_days(id) ON DELETE CASCADE;


--
-- Name: itinerary_stops itinerary_stops_pin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_stops
    ADD CONSTRAINT itinerary_stops_pin_id_fkey FOREIGN KEY (pin_id) REFERENCES public.pins(id) ON DELETE CASCADE;


--
-- Name: pins pins_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pins
    ADD CONSTRAINT pins_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id);


--
-- Name: pins pins_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pins
    ADD CONSTRAINT pins_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: travel_legs travel_legs_itinerary_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.travel_legs
    ADD CONSTRAINT travel_legs_itinerary_day_id_fkey FOREIGN KEY (itinerary_day_id) REFERENCES public.itinerary_days(id) ON DELETE CASCADE;


--
-- Name: trip_members trip_members_trip_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_members
    ADD CONSTRAINT trip_members_trip_id_fkey FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE CASCADE;


--
-- Name: trip_members trip_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trip_members
    ADD CONSTRAINT trip_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: trips trips_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: trips authenticated users can create trips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can create trips" ON public.trips FOR INSERT WITH CHECK ((owner_id = auth.uid()));


--
-- Name: itinerary_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.itinerary_days ENABLE ROW LEVEL SECURITY;

--
-- Name: itinerary_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.itinerary_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: itinerary_stops; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.itinerary_stops ENABLE ROW LEVEL SECURITY;

--
-- Name: pins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;

--
-- Name: travel_legs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.travel_legs ENABLE ROW LEVEL SECURITY;

--
-- Name: itinerary_days trip members can add itinerary days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can add itinerary days" ON public.itinerary_days FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = itinerary_days.trip_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: itinerary_notes trip members can add itinerary notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can add itinerary notes" ON public.itinerary_notes FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = itinerary_notes.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: itinerary_stops trip members can add itinerary stops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can add itinerary stops" ON public.itinerary_stops FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = itinerary_stops.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: pins trip members can add pins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can add pins" ON public.pins FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = pins.trip_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: travel_legs trip members can add travel legs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can add travel legs" ON public.travel_legs FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = travel_legs.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: itinerary_days trip members can delete itinerary days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can delete itinerary days" ON public.itinerary_days FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = itinerary_days.trip_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: itinerary_notes trip members can delete itinerary notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can delete itinerary notes" ON public.itinerary_notes FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = itinerary_notes.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: itinerary_stops trip members can delete itinerary stops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can delete itinerary stops" ON public.itinerary_stops FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = itinerary_stops.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: pins trip members can delete pins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can delete pins" ON public.pins FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = pins.trip_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: travel_legs trip members can delete travel legs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can delete travel legs" ON public.travel_legs FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = travel_legs.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: itinerary_notes trip members can edit itinerary notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can edit itinerary notes" ON public.itinerary_notes FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = itinerary_notes.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: trips trip members can edit trips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can edit trips" ON public.trips FOR UPDATE USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.trip_members
  WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid()))))));


--
-- Name: itinerary_days trip members can update itinerary days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can update itinerary days" ON public.itinerary_days FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = itinerary_days.trip_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: itinerary_stops trip members can update itinerary stops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can update itinerary stops" ON public.itinerary_stops FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = itinerary_stops.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: pins trip members can update pins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can update pins" ON public.pins FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = pins.trip_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: travel_legs trip members can update travel legs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can update travel legs" ON public.travel_legs FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = travel_legs.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: itinerary_days trip members can view itinerary days; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can view itinerary days" ON public.itinerary_days FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = itinerary_days.trip_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: itinerary_notes trip members can view itinerary notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can view itinerary notes" ON public.itinerary_notes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = itinerary_notes.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: itinerary_stops trip members can view itinerary stops; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can view itinerary stops" ON public.itinerary_stops FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = itinerary_stops.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: pins trip members can view pins; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can view pins" ON public.pins FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.trips
  WHERE ((trips.id = pins.trip_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: travel_legs trip members can view travel legs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can view travel legs" ON public.travel_legs FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.itinerary_days
     JOIN public.trips ON ((trips.id = itinerary_days.trip_id)))
  WHERE ((itinerary_days.id = travel_legs.itinerary_day_id) AND ((trips.owner_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.trip_members
          WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid())))))))));


--
-- Name: trips trip members can view trips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip members can view trips" ON public.trips FOR SELECT USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.trip_members
  WHERE ((trip_members.trip_id = trips.id) AND (trip_members.user_id = auth.uid()))))));


--
-- Name: trips trip owner can delete trips; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "trip owner can delete trips" ON public.trips FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: trip_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;

--
-- Name: trips; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

--
-- Name: trip_members users can view own membership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can view own membership" ON public.trip_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION join_trip_via_invite(_token uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.join_trip_via_invite(_token uuid) TO authenticated;


--
-- Name: TABLE itinerary_days; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.itinerary_days TO anon;
GRANT ALL ON TABLE public.itinerary_days TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.itinerary_days TO service_role;


--
-- Name: TABLE itinerary_notes; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.itinerary_notes TO anon;
GRANT ALL ON TABLE public.itinerary_notes TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.itinerary_notes TO service_role;


--
-- Name: TABLE itinerary_stops; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.itinerary_stops TO anon;
GRANT ALL ON TABLE public.itinerary_stops TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.itinerary_stops TO service_role;


--
-- Name: TABLE pins; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.pins TO anon;
GRANT ALL ON TABLE public.pins TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.pins TO service_role;


--
-- Name: TABLE travel_legs; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.travel_legs TO anon;
GRANT ALL ON TABLE public.travel_legs TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.travel_legs TO service_role;


--
-- Name: TABLE trip_members; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.trip_members TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.trip_members TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.trip_members TO service_role;


--
-- Name: TABLE trips; Type: ACL; Schema: public; Owner: -
--

GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.trips TO anon;
GRANT ALL ON TABLE public.trips TO authenticated;
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.trips TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--


