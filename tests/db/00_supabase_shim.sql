-- A minimal stand-in for the parts of Supabase the security rules depend
-- on, so the tests can run on plain Postgres (on GitHub's runners or a
-- laptop) instead of a full Supabase stack. Row-level security itself is
-- built into Postgres and behaves identically; what Supabase adds is the
-- login identity, which its API passes to Postgres as JWT claims. These
-- functions read those claims the same way Supabase's own do.
-- Never run this against the live database.

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role', 'supabase_admin', 'supabase_auth_admin'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      execute format('create role %I nologin', r);
    end if;
  end loop;
end $$;

create schema if not exists auth;
create schema if not exists extensions;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  is_anonymous boolean not null default false
);

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select nullif(auth.jwt() ->> 'role', '')
$$;

grant usage on schema auth, extensions to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
