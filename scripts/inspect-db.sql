-- Read-only snapshot of the live database's shape: no row data, only table
-- names, row-level security, policies, grants, and which migrations ran.
-- Answers questions like "did Wanderlog migrations 002-011 ever apply?".
\pset footer off
\echo '## Tables in public (RLS on?)'
select c.relname as table, c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policy p where p.polrelid = c.oid) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;
\echo '## Columns'
select table_name as table, column_name as column, data_type as type, is_nullable as nullable
from information_schema.columns where table_schema = 'public'
order by table_name, ordinal_position;
\echo '## Policies'
select tablename as table, policyname as policy, cmd, roles::text as roles
from pg_policies where schemaname = 'public' order by 1, 2;
\echo '## Grants to the app roles'
select table_name as table, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by 1, 2 order by 1, 2;
\echo '## Hanh''s Log migrations applied'
select filename, applied_at from hanhs_log_meta.applied_migrations order by 1;
