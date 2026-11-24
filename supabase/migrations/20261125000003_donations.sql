-- Phase 6: donations. Business rows are append-only and every cash movement
-- is written by the finance ledger helper inside the same RPC transaction.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.donation_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint donation_categories_owner_slug unique (owner_id, slug)
);

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  contact_id uuid references public.contacts (id) on delete restrict,
  recipient_name text not null,
  recipient_type text not null
    check (recipient_type in ('individual', 'organization')),
  amount numeric(18, 4) not null check (amount > 0),
  currency_code char(3) not null references public.currencies (code),
  donation_date date not null,
  purpose text,
  category_id uuid references public.donation_categories (id) on delete set null,
  country_code text,
  source_account_id uuid not null references public.accounts (id) on delete restrict,
  payment_method text,
  reference_number text,
  notes text,
  ledger_transaction_id uuid unique
    references public.financial_transactions (id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  constraint donations_country_code_length
    check (country_code is null or length(btrim(country_code)) = 2)
);

create index donations_owner_date_idx
  on public.donations (owner_id, donation_date desc);
create index donations_recipient_idx
  on public.donations (owner_id, contact_id, currency_code, country_code);
create index donations_category_idx
  on public.donations (owner_id, category_id);
create index donations_source_account_idx
  on public.donations (owner_id, source_account_id);

create table public.donation_corrections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  donation_id uuid not null
    references public.donations (id) on delete restrict,
  correction_type text not null
    check (correction_type in ('reversal', 'adjustment')),
  amount numeric(18, 4) not null check (amount > 0),
  reason text not null,
  ledger_transaction_id uuid unique
    references public.financial_transactions (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index donation_corrections_donation_idx
  on public.donation_corrections (owner_id, donation_id);

-- ---------------------------------------------------------------------------
-- Category seeding for every owner, now and on profile creation.
-- ---------------------------------------------------------------------------

create or replace function public.seed_donation_categories()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.donation_categories (owner_id, name, slug)
  select new.id, v.name, v.slug
  from (values
    ('Charity', 'charity'),
    ('Mosque', 'mosque'),
    ('Orphanage', 'orphanage'),
    ('Education', 'education'),
    ('Medical support', 'medical_support'),
    ('Family assistance', 'family_assistance'),
    ('Disaster relief', 'disaster_relief'),
    ('Religious', 'religious'),
    ('Community', 'community'),
    ('Other', 'other')
  ) as v(name, slug)
  on conflict (owner_id, slug) do nothing;
  return new;
end;
$$;

revoke all on function public.seed_donation_categories()
  from public, anon, authenticated;

create trigger profiles_seed_donation_categories
  after insert on public.profiles
  for each row execute function public.seed_donation_categories();

-- Backfill owners who existed before this migration.
insert into public.donation_categories (owner_id, name, slug)
select p.id, v.name, v.slug
from public.profiles p
cross join (values
  ('Charity', 'charity'),
  ('Mosque', 'mosque'),
  ('Orphanage', 'orphanage'),
  ('Education', 'education'),
  ('Medical support', 'medical_support'),
  ('Family assistance', 'family_assistance'),
  ('Disaster relief', 'disaster_relief'),
  ('Religious', 'religious'),
  ('Community', 'community'),
  ('Other', 'other')
) as v(name, slug)
on conflict (owner_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- Immutability and audit triggers.
-- ---------------------------------------------------------------------------

create or replace function public.reject_donation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'Donations are immutable'
    using errcode = '42501';
end;
$$;

revoke all on function public.reject_donation_mutation()
  from public, anon, authenticated;

create trigger donations_immutable
  before update or delete on public.donations
  for each row execute function public.reject_donation_mutation();

create trigger donation_categories_set_updated_at
  before update on public.donation_categories
  for each row execute function public.set_updated_at();

create trigger donation_categories_audit
  after insert or update or delete on public.donation_categories
  for each row execute function public.audit_mutation();
create trigger donations_audit
  after insert on public.donations
  for each row execute function public.audit_mutation();
create trigger donation_corrections_audit
  after insert on public.donation_corrections
  for each row execute function public.audit_mutation();

-- ---------------------------------------------------------------------------
-- RLS and grants. Donations/corrections deliberately have no update or delete
-- policy: all adjustments go through correct_donation().
-- ---------------------------------------------------------------------------

alter table public.donation_categories enable row level security;
alter table public.donations enable row level security;
alter table public.donation_corrections enable row level security;

create policy donation_categories_owner_all on public.donation_categories
  for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy donations_owner_read on public.donations
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner());
create policy donations_owner_insert on public.donations
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy donation_corrections_owner_read on public.donation_corrections
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner());
create policy donation_corrections_owner_insert on public.donation_corrections
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_owner());

revoke all on public.donation_categories, public.donations,
  public.donation_corrections from public, anon;
revoke update, delete on public.donations,
  public.donation_corrections from authenticated;

grant select, insert, update, delete on public.donation_categories to authenticated;
grant select, insert on public.donations to authenticated;
grant select, insert on public.donation_corrections to authenticated;
