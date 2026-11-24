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

-- ---------------------------------------------------------------------------
-- Timestamps and audit. Repayment rows are append-only: no updated_at column.
-- ---------------------------------------------------------------------------

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();
create trigger loans_given_set_updated_at
  before update on public.loans_given
  for each row execute function public.set_updated_at();
create trigger loans_taken_set_updated_at
  before update on public.loans_taken
  for each row execute function public.set_updated_at();

create trigger contacts_audit
  after insert or update or delete on public.contacts
  for each row execute function public.audit_mutation();
create trigger loans_given_audit
  after insert or update or delete on public.loans_given
  for each row execute function public.audit_mutation();
create trigger loan_given_repayments_audit
  after insert or update or delete on public.loan_given_repayments
  for each row execute function public.audit_mutation();
create trigger loans_taken_audit
  after insert or update or delete on public.loans_taken
  for each row execute function public.audit_mutation();
create trigger loan_taken_repayments_audit
  after insert or update or delete on public.loan_taken_repayments
  for each row execute function public.audit_mutation();

-- ---------------------------------------------------------------------------
-- Overpayment backstop. RPCs check first; this trigger also protects direct
-- inserts/updates. The parent row is locked so concurrent repayments cannot
-- both pass the check.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_repayment_limit()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_loan_amount numeric(18, 4);
  v_loan_owner uuid;
  v_loan_cancelled_at timestamptz;
  v_loan_currency char(3);
  v_account_currency char(3);
  v_total numeric(18, 4);
begin
  if tg_table_name = 'loan_given_repayments' then
    select l.amount, l.owner_id, l.cancelled_at, l.currency_code
      into v_loan_amount, v_loan_owner, v_loan_cancelled_at, v_loan_currency
      from public.loans_given l
     where l.id = new.loan_id
       and l.owner_id = new.owner_id
     for update;

    if not found then
      raise exception 'Loan not found' using errcode = '22023';
    end if;
    if v_loan_cancelled_at is not null then
      raise exception 'Loan is cancelled' using errcode = '22023';
    end if;

    select a.currency_code
      into v_account_currency
      from public.accounts a
     where a.id = new.receiving_account_id
       and a.owner_id = v_loan_owner;

    if not found then
      raise exception 'Account not found' using errcode = '22023';
    end if;
    if v_account_currency is distinct from v_loan_currency then
      raise exception 'Repayment currency does not match the loan currency'
        using errcode = '22023';
    end if;

    select coalesce(sum(r.amount), 0)
      into v_total
      from public.loan_given_repayments r
     where r.loan_id = new.loan_id
       and r.cancelled_at is null
       and (tg_op <> 'UPDATE' or r.id <> new.id);
  else
    select l.amount, l.owner_id, l.cancelled_at, l.currency_code
      into v_loan_amount, v_loan_owner, v_loan_cancelled_at, v_loan_currency
      from public.loans_taken l
     where l.id = new.loan_id
       and l.owner_id = new.owner_id
     for update;

    if not found then
      raise exception 'Loan not found' using errcode = '22023';
    end if;
    if v_loan_cancelled_at is not null then
      raise exception 'Loan is cancelled' using errcode = '22023';
    end if;

    select a.currency_code
      into v_account_currency
      from public.accounts a
     where a.id = new.source_account_id
       and a.owner_id = v_loan_owner;

    if not found then
      raise exception 'Account not found' using errcode = '22023';
    end if;
    if v_account_currency is distinct from v_loan_currency then
      raise exception 'Repayment currency does not match the loan currency'
        using errcode = '22023';
    end if;

    select coalesce(sum(r.amount), 0)
      into v_total
      from public.loan_taken_repayments r
     where r.loan_id = new.loan_id
       and r.cancelled_at is null
       and (tg_op <> 'UPDATE' or r.id <> new.id);
  end if;

  if new.cancelled_at is null and v_total + new.amount > v_loan_amount then
    raise exception 'Repayment total exceeds the loan amount'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_repayment_limit()
  from public, anon, authenticated;

create trigger loan_given_repayments_limit
  before insert or update on public.loan_given_repayments
  for each row execute function public.enforce_repayment_limit();
create trigger loan_taken_repayments_limit
  before insert or update on public.loan_taken_repayments
  for each row execute function public.enforce_repayment_limit();
