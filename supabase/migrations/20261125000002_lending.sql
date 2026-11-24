-- Phase 5: contacts, lending, borrowing and their append-only repayments.
-- Every cash movement is written by the Phase 4 ledger RPC in the same
-- transaction as the business row. Clients never write ledger rows directly.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  full_name text not null,
  contact_type text not null default 'individual'
    check (contact_type in ('individual', 'organization')),
  phone text,
  email text,
  address text,
  country_code text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_full_name_not_blank check (btrim(full_name) <> '')
);

create index contacts_owner_name_idx
  on public.contacts (owner_id, lower(full_name));

create table public.loans_given (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  contact_id uuid not null references public.contacts (id) on delete restrict,
  amount numeric(18, 4) not null check (amount > 0),
  currency_code char(3) not null references public.currencies (code),
  date_given date not null,
  reason text,
  payment_method text,
  source_account_id uuid not null references public.accounts (id) on delete restrict,
  expected_repayment_date date,
  reference_number text,
  notes text,
  cancelled_at timestamptz,
  disbursement_ledger_id uuid unique
    references public.financial_transactions (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loans_given_dates
    check (expected_repayment_date is null or expected_repayment_date >= date_given)
);

create index loans_given_owner_contact_idx
  on public.loans_given (owner_id, contact_id, date_given desc);

create table public.loan_given_repayments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  loan_id uuid not null references public.loans_given (id) on delete restrict,
  amount numeric(18, 4) not null check (amount > 0),
  repayment_date date not null,
  receiving_account_id uuid not null references public.accounts (id) on delete restrict,
  payment_method text,
  reference_number text,
  notes text,
  ledger_transaction_id uuid unique
    references public.financial_transactions (id) on delete restrict,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index loan_given_repayments_owner_loan_idx
  on public.loan_given_repayments (owner_id, loan_id, repayment_date);

create table public.loans_taken (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  lender_contact_id uuid not null references public.contacts (id) on delete restrict,
  amount numeric(18, 4) not null check (amount > 0),
  currency_code char(3) not null references public.currencies (code),
  date_borrowed date not null,
  reason text,
  expected_repayment_date date,
  receiving_account_id uuid not null references public.accounts (id) on delete restrict,
  agreement_details text,
  notes text,
  cancelled_at timestamptz,
  receipt_ledger_id uuid unique
    references public.financial_transactions (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loans_taken_dates
    check (expected_repayment_date is null or expected_repayment_date >= date_borrowed)
);

create index loans_taken_owner_contact_idx
  on public.loans_taken (owner_id, lender_contact_id, date_borrowed desc);

create table public.loan_taken_repayments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  loan_id uuid not null references public.loans_taken (id) on delete restrict,
  amount numeric(18, 4) not null check (amount > 0),
  payment_date date not null,
  source_account_id uuid not null references public.accounts (id) on delete restrict,
  payment_method text,
  reference_number text,
  notes text,
  ledger_transaction_id uuid unique
    references public.financial_transactions (id) on delete restrict,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

create index loan_taken_repayments_owner_loan_idx
  on public.loan_taken_repayments (owner_id, loan_id, payment_date);
