-- Minimal stand-in for the parts of a Supabase database our migration relies on.
-- Used ONLY by the PGlite-based RLS tests; never applied to a real project.
--
-- Mirrors Supabase behaviour that matters for security testing:
--   * anon / authenticated roles without RLS bypass
--   * auth.uid() derived from the request JWT "sub" claim (a GUC set per request)
--   * Supabase's default privileges, which grant ALL on new public tables to
--     anon and authenticated — so the migration's REVOKEs are actually exercised.

create role anon nologin noinherit;
create role authenticated nologin noinherit;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique
);

create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;

alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
