-- Phase 4: finance core. Accounts, classification categories, the append-only
-- cash ledger, transfers, snapshot-based reporting rates and the two computed
-- views. All writes by clients go through RLS + owner-checked RPCs.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  country_code text,
  currency_code char(3) not null references public.currencies (code),
  account_type text not null default 'cash'
    check (account_type in ('bank', 'savings', 'cash', 'mobile_money', 'other')),
  opening_balance numeric(18, 4) not null default 0,
  opening_date date,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounts_owner_name unique (owner_id, name)
);

create index accounts_owner_country_currency_idx
  on public.accounts (owner_id, country_code, currency_code);

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  parent_id uuid references public.finance_categories (id) on delete set null,
  icon text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_categories_owner_kind_name unique (owner_id, kind, name),
  constraint finance_categories_no_self_parent check (parent_id is null or parent_id <> id)
);

create index finance_categories_owner_kind_idx
  on public.finance_categories (owner_id, kind, name);

create table public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  account_id uuid not null references public.accounts (id) on delete restrict,
  transaction_type text not null check (transaction_type in (
    'income', 'expense', 'transfer_out', 'transfer_in',
    'loan_disbursed', 'loan_repayment_received',
    'borrowing_received', 'borrowing_repayment_paid',
    'donation', 'correction', 'reversal'
  )),
  direction smallint not null check (direction in (-1, 1)),
  amount numeric(18, 4) not null check (amount > 0),
  currency_code char(3) not null references public.currencies (code),
  business_date date not null,
  category_id uuid references public.finance_categories (id) on delete set null,
  transfer_id uuid,
  reference_type text,
  reference_id uuid,
  description text,
  notes text,
  attachment_path text,
  reverses_transaction_id uuid references public.financial_transactions (id) on delete restrict,
  is_reversal boolean not null default false,
  exchange_rate_to_reporting numeric(18, 8) not null check (exchange_rate_to_reporting > 0),
  reporting_currency char(3) not null references public.currencies (code),
  amount_reporting numeric(18, 4) not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

create index financial_transactions_owner_date_idx
  on public.financial_transactions (owner_id, business_date desc);
create index financial_transactions_owner_account_date_idx
  on public.financial_transactions (owner_id, account_id, business_date);
create index financial_transactions_owner_reference_idx
  on public.financial_transactions (owner_id, reference_type, reference_id);
create index financial_transactions_owner_type_date_idx
  on public.financial_transactions (owner_id, transaction_type, business_date);

create table public.account_transfers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  source_account_id uuid not null references public.accounts (id) on delete restrict,
  destination_account_id uuid not null references public.accounts (id) on delete restrict,
  source_amount numeric(18, 4) not null check (source_amount > 0),
  source_currency char(3) not null references public.currencies (code),
  destination_amount numeric(18, 4) not null check (destination_amount > 0),
  destination_currency char(3) not null references public.currencies (code),
  exchange_rate numeric(18, 8) not null check (exchange_rate > 0),
  fee_amount numeric(18, 4) not null default 0 check (fee_amount >= 0),
  transfer_date date not null,
  reference_number text,
  notes text,
  out_ledger_id uuid references public.financial_transactions (id) on delete set null,
  in_ledger_id uuid references public.financial_transactions (id) on delete set null,
  fee_ledger_id uuid references public.financial_transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_transfers_distinct_accounts
    check (source_account_id <> destination_account_id)
);

create index account_transfers_owner_date_idx
  on public.account_transfers (owner_id, transfer_date desc);
create index account_transfers_owner_source_idx
  on public.account_transfers (owner_id, source_account_id);
create index account_transfers_owner_destination_idx
  on public.account_transfers (owner_id, destination_account_id);

-- The two tables reference each other; add the ledger -> transfer FK once both
-- relations exist.
alter table public.financial_transactions
  add constraint financial_transactions_transfer_fk
  foreign key (transfer_id) references public.account_transfers (id) on delete set null;
