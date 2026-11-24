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
