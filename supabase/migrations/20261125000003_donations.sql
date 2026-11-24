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
