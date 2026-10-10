-- Tiny assertion helpers. Results go into test.results; run.sh prints them
-- and fails if any check failed. Helpers are SECURITY DEFINER so they can
-- record results while the test is acting as an app user.

create schema if not exists test;
create table if not exists test.results (n serial, ok boolean, name text, detail text);
grant usage on schema test to anon, authenticated;

-- Act as a signed-in person (or as the not-signed-in visitor with null).
-- Same mechanism Supabase's API uses: a role plus JWT claims. Session-level
-- on purpose: each test file runs statement by statement, not in one block.
create or replace function test.act_as(_user uuid, _anonymous boolean default false) returns void
language plpgsql as $$
begin
  execute 'reset role';   -- back to the test runner before switching person
  if _user is null then
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
    execute 'set role anon';
  else
    perform set_config('request.jwt.claims',
      json_build_object('sub', _user, 'role', 'authenticated', 'is_anonymous', _anonymous)::text, false);
    execute 'set role authenticated';
  end if;
end $$;

create or replace function test.ok(_ok boolean, _name text, _detail text default null) returns void
language sql security definer as $$
  insert into test.results (ok, name, detail) values (coalesce(_ok, false), _name, _detail)
$$;

-- Passes if the statement is refused (permission error, RLS violation, or a
-- raised exception) — used for "a stranger must NOT be able to do this".
create or replace function test.refused(_sql text, _name text) returns void
language plpgsql as $$
begin
  execute _sql;
  perform test.ok(false, _name, 'statement was allowed but should have been refused');
exception when others then
  perform test.ok(true, _name, sqlerrm);
end $$;

-- Number of rows the current user can see in a query.
create or replace function test.visible(_sql text) returns bigint
language plpgsql as $$
declare c bigint;
begin
  execute format('select count(*) from (%s) q', _sql) into c;
  return c;
exception when insufficient_privilege then
  return 0;   -- "not allowed to look at all" also means "sees nothing"
end $$;

grant execute on all functions in schema test to anon, authenticated;
