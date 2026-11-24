-- Phase 1: identity, settings, audit, currencies and exchange rates.
-- All application authorization goes through RLS + is_owner(); this migration
-- never trusts a client-supplied role claim.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  email text not null unique,
  display_name text not null,
  role text not null default 'owner' check (role in ('owner')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  headline text,
  bio_md text,
  location text,
  timezone text not null default 'UTC',
  avatar_path text,
  resume_path text,
  resume_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one owner row can ever exist.
create unique index profiles_single_owner_idx on public.profiles ((role)) where role = 'owner';

create table public.currencies (
  code char(3) primary key,
  name text not null,
  minor_units smallint not null check (minor_units between 0 and 4),
  is_active boolean not null default true
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete restrict,
  reporting_currency char(3) not null default 'EUR' references public.currencies (code),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  date_format text not null default 'YYYY-MM-DD',
  locale text not null default 'en-US',
  mfa_enforced boolean not null default true,
  reporting_notes text,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  reason text,
  occurred_at timestamptz not null default now()
);

create index audit_logs_table_record_idx on public.audit_logs (table_name, record_id, occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  from_currency char(3) not null references public.currencies (code),
  to_currency char(3) not null references public.currencies (code),
  rate numeric(18, 8) not null check (rate > 0),
  effective_date date not null,
  source text not null,
  created_at timestamptz not null default now(),
  constraint exchange_rates_no_self check (from_currency <> to_currency),
  constraint exchange_rates_unique unique (from_currency, to_currency, effective_date)
);

create index exchange_rates_lookup_idx
  on public.exchange_rates (from_currency, to_currency, effective_date desc);

-- ---------------------------------------------------------------------------
-- Shared functions
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- The single owner must not be able to suspend itself or change its role/email
-- through the profile form; doing so would permanently disable every RLS policy.
create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.status is distinct from old.status then
    raise exception 'Profile identity fields are managed by the system'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_identity()
  from public, anon, authenticated;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'owner'
      and p.status = 'active'
  );
$$;

revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- Called by every financial/business RPC in later phases.
create or replace function public.require_owner()
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not public.is_owner() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.require_owner() from public, anon;
grant execute on function public.require_owner() to authenticated;

-- Narrow server-side lookup for the public resume. The path is deliberately not
-- part of public_profiles_v; /api/resume uses this RPC and the matching storage
-- policy below. No other private-bucket object is readable by anonymous users.
create or replace function public.get_resume_path()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.resume_path
  from public.profiles p
  where p.role = 'owner'
    and p.status = 'active'
    and p.resume_path is not null
  limit 1;
$$;

revoke all on function public.get_resume_path() from public;
grant execute on function public.get_resume_path() to anon, authenticated;

-- Append-only audit backstop. SECURITY DEFINER so triggers can write even when
-- the caller has no INSERT grant on audit_logs.
create or replace function public.audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_new := null;
    v_id := old.id;
  elsif tg_op = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(new);
    v_id := new.id;
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_id := new.id;
  end if;

  insert into public.audit_logs (actor_id, action, table_name, record_id, old_data, new_data)
  values ((select auth.uid()), tg_op, tg_table_name, v_id, v_old, v_new);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_mutation() from public, anon, authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger profiles_protect_identity
  before update on public.profiles
  for each row execute function public.protect_profile_identity();

create trigger profiles_audit
  after insert or update or delete on public.profiles
  for each row execute function public.audit_mutation();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.currencies enable row level security;
alter table public.exchange_rates enable row level security;

create policy profiles_owner_all on public.profiles
  for all to authenticated
  using (id = (select auth.uid()) and public.is_owner())
  with check (id = (select auth.uid()) and public.is_owner());

create policy user_settings_owner_all on public.user_settings
  for all to authenticated
  using (user_id = (select auth.uid()) and public.is_owner())
  with check (user_id = (select auth.uid()) and public.is_owner());

create policy audit_logs_owner_read on public.audit_logs
  for select to authenticated
  using (public.is_owner());

create policy currencies_public_read on public.currencies
  for select to anon, authenticated
  using (is_active);

create policy currencies_owner_all on public.currencies
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- Exchange rates are immutable once recorded so historical translations stay stable.
create policy exchange_rates_owner_read on public.exchange_rates
  for select to authenticated
  using (public.is_owner());
create policy exchange_rates_owner_insert on public.exchange_rates
  for insert to authenticated
  with check (public.is_owner());

-- Public pages must not read profile.email or the private resume storage path.
-- avatar_path points into the public portfolio bucket and is intentionally visible.
-- Default (definer) view ownership intentionally bypasses profiles RLS.
create or replace view public.public_profiles_v with (security_barrier = true) as
select
  p.id,
  p.display_name,
  p.headline,
  p.bio_md,
  p.location,
  p.avatar_path,
  p.resume_updated_at,
  p.timezone,
  p.created_at,
  p.updated_at
from public.profiles p
where p.status = 'active' and p.role = 'owner';

revoke all on public.public_profiles_v from public;
grant select on public.public_profiles_v to anon, authenticated;

revoke all on public.audit_logs, public.profiles, public.user_settings,
  public.exchange_rates from anon;
revoke update, delete on public.audit_logs from authenticated;
revoke update, delete on public.exchange_rates from anon, authenticated;
revoke insert, update, delete on public.currencies from anon;

-- Explicit grants keep public reads working even when default table exposure is disabled.
grant select on public.audit_logs to authenticated;
grant select on public.currencies to anon;
grant select, insert on public.exchange_rates to authenticated;
grant select on public.currencies to authenticated;
grant select, insert, update, delete on public.profiles, public.user_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets. Object policies are the only download/list/upload gate.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('portfolio', 'portfolio', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/avif'])
on conflict (id) do update set
  -- Never flip an existing bucket to public; that could expose pre-existing objects.
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 20971520, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy portfolio_objects_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'portfolio');

create policy portfolio_objects_owner_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_owner()
  )
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_owner()
  );

create policy document_objects_owner_all on storage.objects
  for all to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_owner()
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_owner()
  );

-- The resume is the one private-bucket object intended for public reading.
-- The path must match the active owner's current resume_path exactly; no
-- filename wildcard and no owner-folder guessing are accepted.
create policy resume_object_public_read on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'documents'
    and name = (select public.get_resume_path())
  );

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

insert into public.currencies (code, name, minor_units) values
  ('EUR', 'Euro', 2),
  ('BDT', 'Bangladeshi Taka', 2)
on conflict (code) do update set name = excluded.name, minor_units = excluded.minor_units;
