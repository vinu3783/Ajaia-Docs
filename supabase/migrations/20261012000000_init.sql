-- Ajaia Docs — initial schema, access control and RLS.
--
-- Security model (see ARCHITECTURE.md):
--   * Every document has exactly one owner (owner_id), set from auth.uid() and immutable.
--   * Owners can read/update/delete their documents and manage shares.
--   * A share grants one registered user 'viewer' (read) or 'editor' (read + edit title/content).
--   * Recipients can never delete documents, change ownership or manage shares.
--   * All of this is enforced by grants + RLS below, not by the UI.
--   * Helper functions that must look across tables are SECURITY DEFINER in a non-exposed
--     "private" schema. This avoids RLS policy recursion (documents <-> document_shares).

create schema if not exists private;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: a minimal public mirror of auth.users (id + email) so owners can
-- share by email and recipients can see who shared a document with them.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);
create unique index profiles_email_lower_idx on public.profiles (lower(email));

create function private.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_change
  after insert or update of email on auth.users
  for each row execute function private.handle_auth_user_change();

-- Backfill users that existed before this migration.
insert into public.profiles (id, email)
select id, email from auth.users where email is not null
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null default 'Untitled document',
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_title_length check (char_length(btrim(title)) between 1 and 200),
  constraint documents_content_is_doc check (jsonb_typeof(content) = 'object' and content ->> 'type' = 'doc'),
  constraint documents_content_size check (octet_length(content::text) <= 5000000)
);
create index documents_owner_updated_idx on public.documents (owner_id, updated_at desc);

create function private.documents_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Document ownership cannot be changed' using errcode = '42501';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger documents_before_update
  before update on public.documents
  for each row execute function private.documents_before_update();

-- ---------------------------------------------------------------------------
-- Shares
-- ---------------------------------------------------------------------------
create table public.document_shares (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  shared_with_user_id uuid not null references public.profiles (id) on delete cascade,
  permission text not null default 'viewer',
  created_at timestamptz not null default now(),
  constraint document_shares_permission check (permission in ('viewer', 'editor')),
  constraint document_shares_unique unique (document_id, shared_with_user_id)
);
create index document_shares_user_idx on public.document_shares (shared_with_user_id);

-- ---------------------------------------------------------------------------
-- RLS helper functions (SECURITY DEFINER: they read tables without re-entering
-- RLS, which is what prevents infinite policy recursion). Each only answers a
-- question about the *calling* user, so it cannot leak other users' data.
-- ---------------------------------------------------------------------------
create function private.is_document_owner(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_document_id and d.owner_id = (select auth.uid())
  );
$$;

create function private.document_share_permission(p_document_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.permission from public.document_shares s
  where s.document_id = p_document_id and s.shared_with_user_id = (select auth.uid());
$$;

-- A profile is visible to yourself and to users you share a document with (either direction).
create function private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = (select auth.uid()) or exists (
    select 1
    from public.document_shares s
    join public.documents d on d.id = s.document_id
    where (d.owner_id = (select auth.uid()) and s.shared_with_user_id = p_profile_id)
       or (d.owner_id = p_profile_id and s.shared_with_user_id = (select auth.uid()))
  );
$$;

create function private.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p where lower(p.email) = lower(btrim(p_email));
$$;

revoke all on all functions in schema private from public;
grant execute on function
  private.is_document_owner(uuid),
  private.document_share_permission(uuid),
  private.can_view_profile(uuid),
  private.find_user_id_by_email(text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges: least privilege at the column level. Clients may only ever write
-- title/content (documents) and permission (shares). owner_id comes from the
-- auth.uid() default and cannot be supplied or changed by the browser.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.documents, public.document_shares from anon, authenticated;

grant select on public.profiles to authenticated;

grant select, delete on public.documents to authenticated;
grant insert (title, content) on public.documents to authenticated;
grant update (title, content) on public.documents to authenticated;

grant select, delete on public.document_shares to authenticated;
grant insert (document_id, shared_with_user_id, permission) on public.document_shares to authenticated;
grant update (permission) on public.document_shares to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_shares enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (private.can_view_profile(id));

create policy documents_select on public.documents
  for select to authenticated
  using (owner_id = (select auth.uid()) or private.document_share_permission(id) is not null);

create policy documents_insert on public.documents
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy documents_update on public.documents
  for update to authenticated
  using (owner_id = (select auth.uid()) or private.document_share_permission(id) = 'editor')
  with check (owner_id = (select auth.uid()) or private.document_share_permission(id) = 'editor');

create policy documents_delete on public.documents
  for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy document_shares_select on public.document_shares
  for select to authenticated
  using (shared_with_user_id = (select auth.uid()) or private.is_document_owner(document_id));

create policy document_shares_insert on public.document_shares
  for insert to authenticated
  with check (private.is_document_owner(document_id) and shared_with_user_id <> (select auth.uid()));

create policy document_shares_update on public.document_shares
  for update to authenticated
  using (private.is_document_owner(document_id))
  with check (private.is_document_owner(document_id));

create policy document_shares_delete on public.document_shares
  for delete to authenticated
  using (private.is_document_owner(document_id));

-- ---------------------------------------------------------------------------
-- RPC: share a document by email. SECURITY INVOKER — the insert below runs
-- under the caller's RLS policies; only the email lookup is privileged, and it
-- is performed only after confirming the caller owns the document (so
-- non-owners cannot probe which emails are registered).
-- ---------------------------------------------------------------------------
create function public.share_document(p_document_id uuid, p_email text, p_permission text default 'viewer')
returns public.document_shares
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_share public.document_shares;
begin
  if p_permission is null or p_permission not in ('viewer', 'editor') then
    raise exception 'Permission must be viewer or editor' using errcode = '22023';
  end if;
  if not private.is_document_owner(p_document_id) then
    raise exception 'Only the document owner can share it' using errcode = '42501';
  end if;

  v_user_id := private.find_user_id_by_email(p_email);
  if v_user_id is null then
    raise exception 'No registered user has that email address' using errcode = 'P0002';
  end if;
  if v_user_id = (select auth.uid()) then
    raise exception 'You already own this document' using errcode = '22023';
  end if;

  begin
    insert into public.document_shares (document_id, shared_with_user_id, permission)
    values (p_document_id, v_user_id, p_permission)
    returning * into v_share;
  exception when unique_violation then
    raise exception 'This document is already shared with that user' using errcode = '23505';
  end;
  return v_share;
end;
$$;

revoke all on function public.share_document(uuid, text, text) from public, anon;
grant execute on function public.share_document(uuid, text, text) to authenticated;
