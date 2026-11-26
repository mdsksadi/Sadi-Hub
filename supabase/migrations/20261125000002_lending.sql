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

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------

alter table public.contacts enable row level security;
alter table public.loans_given enable row level security;
alter table public.loan_given_repayments enable row level security;
alter table public.loans_taken enable row level security;
alter table public.loan_taken_repayments enable row level security;

create policy contacts_owner_select on public.contacts
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner());
create policy contacts_owner_insert on public.contacts
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_owner());
create policy contacts_owner_update on public.contacts
  for update to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy loans_given_owner_select on public.loans_given
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner());
create policy loans_given_owner_insert on public.loans_given
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_owner());
create policy loans_given_owner_update on public.loans_given
  for update to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy loan_given_repayments_owner_select on public.loan_given_repayments
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner());
create policy loan_given_repayments_owner_insert on public.loan_given_repayments
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy loans_taken_owner_select on public.loans_taken
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner());
create policy loans_taken_owner_insert on public.loans_taken
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_owner());
create policy loans_taken_owner_update on public.loans_taken
  for update to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy loan_taken_repayments_owner_select on public.loan_taken_repayments
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner());
create policy loan_taken_repayments_owner_insert on public.loan_taken_repayments
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_owner());

revoke all on public.contacts, public.loans_given, public.loan_given_repayments,
  public.loans_taken, public.loan_taken_repayments from anon, authenticated;

grant select, insert, update on public.contacts, public.loans_given,
  public.loans_taken to authenticated;
grant select, insert on public.loan_given_repayments,
  public.loan_taken_repayments to authenticated;

-- ---------------------------------------------------------------------------
-- Computed views. Cancelled loans stay visible in the status views so their
-- history can be reviewed, but are excluded from contact lending totals.
-- ---------------------------------------------------------------------------

create or replace view public.loans_given_status_v
with (security_invoker = true) as
select
  lg.*,
  coalesce(r.total_repaid, 0) as total_repaid,
  lg.amount - coalesce(r.total_repaid, 0) as outstanding,
  case
    when lg.cancelled_at is not null then 'Cancelled'
    when lg.amount - coalesce(r.total_repaid, 0) <= 0 then 'Fully Repaid'
    when lg.amount - coalesce(r.total_repaid, 0) < lg.amount then 'Partially Repaid'
    when lg.expected_repayment_date is not null
      and lg.expected_repayment_date < current_date then 'Overdue'
    else 'Pending'
  end::text as status
from public.loans_given lg
left join (
  select loan_id, sum(amount) as total_repaid
  from public.loan_given_repayments
  where cancelled_at is null
  group by loan_id
) r on r.loan_id = lg.id;

create or replace view public.loans_taken_status_v
with (security_invoker = true) as
select
  lt.*,
  coalesce(r.total_repaid, 0) as total_repaid,
  lt.amount - coalesce(r.total_repaid, 0) as outstanding,
  case
    when lt.cancelled_at is not null then 'Cancelled'
    when lt.amount - coalesce(r.total_repaid, 0) <= 0 then 'Fully Repaid'
    when lt.amount - coalesce(r.total_repaid, 0) < lt.amount then 'Partially Repaid'
    when lt.expected_repayment_date is not null
      and lt.expected_repayment_date < current_date then 'Overdue'
    else 'Active'
  end::text as status
from public.loans_taken lt
left join (
  select loan_id, sum(amount) as total_repaid
  from public.loan_taken_repayments
  where cancelled_at is null
  group by loan_id
) r on r.loan_id = lt.id;

create or replace view public.contact_lending_summary_v
with (security_invoker = true) as
with loan_totals as (
  select
    l.id,
    l.owner_id,
    l.contact_id,
    l.currency_code,
    l.amount,
    l.date_given,
    l.expected_repayment_date,
    coalesce(r.total_repaid, 0) as total_repaid
  from public.loans_given l
  left join (
    select loan_id, sum(amount) as total_repaid
    from public.loan_given_repayments
    where cancelled_at is null
    group by loan_id
  ) r on r.loan_id = l.id
  where l.cancelled_at is null
)
select
  lt.owner_id,
  c.id as contact_id,
  c.full_name,
  c.contact_type,
  lt.currency_code,
  sum(lt.amount) as lent_amount,
  sum(lt.total_repaid) as repaid_amount,
  sum(lt.amount - lt.total_repaid) as outstanding_amount,
  coalesce(sum(case
    when lt.expected_repayment_date < current_date
      and lt.amount - lt.total_repaid > 0
    then lt.amount - lt.total_repaid
    else 0
  end), 0) as overdue_amount,
  count(*) as loan_count,
  min(lt.date_given) as first_date,
  max(lt.date_given) as last_date
from loan_totals lt
join public.contacts c
  on c.id = lt.contact_id and c.owner_id = lt.owner_id
group by lt.owner_id, c.id, c.full_name, c.contact_type, lt.currency_code;

revoke all on public.loans_given_status_v, public.loans_taken_status_v,
  public.contact_lending_summary_v from anon, authenticated;
grant select on public.loans_given_status_v, public.loans_taken_status_v,
  public.contact_lending_summary_v to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic business RPCs
-- ---------------------------------------------------------------------------

create or replace function public.create_loan_given(
  p_contact_id uuid,
  p_amount numeric,
  p_currency_code char(3),
  p_date_given date,
  p_source_account_id uuid,
  p_expected_repayment_date date default null,
  p_reason text default null,
  p_payment_method text default null,
  p_reference_number text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := (select auth.uid());
  v_account_currency char(3);
  v_balance numeric(18, 4);
  v_loan_id uuid := gen_random_uuid();
  v_ledger_id uuid;
begin
  perform public.require_owner();

  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  select a.currency_code
    into v_account_currency
    from public.accounts a
   where a.id = p_source_account_id
     and a.owner_id = v_owner
   for update;

  if not found then
    raise exception 'Account not found' using errcode = '22023';
  end if;
  if v_account_currency is distinct from p_currency_code then
    raise exception 'Currency does not match the selected account'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.contacts c
     where c.id = p_contact_id and c.owner_id = v_owner
  ) then
    raise exception 'Contact not found' using errcode = '22023';
  end if;

  select a.opening_balance + coalesce((
    select sum(t.direction * t.amount)
      from public.financial_transactions t
     where t.account_id = a.id and t.owner_id = a.owner_id
  ), 0)
    into v_balance
    from public.accounts a
   where a.id = p_source_account_id and a.owner_id = v_owner;

  if v_balance < p_amount then
    raise exception 'Insufficient balance' using errcode = '22023';
  end if;

  v_ledger_id := public.record_ledger_movement(
    v_owner,
    p_source_account_id,
    'loan_disbursed',
    (-1)::smallint,
    p_amount,
    p_date_given,
    null,
    null,
    'loan_given',
    v_loan_id,
    coalesce(p_reason, 'Loan given'),
    p_notes,
    null
  );

  insert into public.loans_given (
    id, owner_id, contact_id, amount, currency_code, date_given,
    reason, payment_method, source_account_id, expected_repayment_date,
    reference_number, notes, disbursement_ledger_id
  )
  values (
    v_loan_id, v_owner, p_contact_id, p_amount, p_currency_code, p_date_given,
    p_reason, p_payment_method, p_source_account_id, p_expected_repayment_date,
    p_reference_number, p_notes, v_ledger_id
  );

  return v_loan_id;
end;
$$;

create or replace function public.record_loan_given_repayment(
  p_loan_id uuid,
  p_amount numeric,
  p_repayment_date date,
  p_receiving_account_id uuid,
  p_payment_method text default null,
  p_reference_number text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := (select auth.uid());
  v_loan_amount numeric(18, 4);
  v_loan_currency char(3);
  v_loan_cancelled_at timestamptz;
  v_account_currency char(3);
  v_total numeric(18, 4);
  v_repayment_id uuid := gen_random_uuid();
  v_ledger_id uuid;
begin
  perform public.require_owner();

  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  select l.amount, l.currency_code, l.cancelled_at
    into v_loan_amount, v_loan_currency, v_loan_cancelled_at
    from public.loans_given l
   where l.id = p_loan_id and l.owner_id = v_owner
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
   where a.id = p_receiving_account_id and a.owner_id = v_owner
   for update;

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
   where r.loan_id = p_loan_id
     and r.owner_id = v_owner
     and r.cancelled_at is null;

  if v_total + p_amount > v_loan_amount then
    raise exception 'Repayment total exceeds the loan amount'
      using errcode = '22023';
  end if;

  v_ledger_id := public.record_ledger_movement(
    v_owner,
    p_receiving_account_id,
    'loan_repayment_received',
    1::smallint,
    p_amount,
    p_repayment_date,
    null,
    null,
    'loan_given_repayment',
    v_repayment_id,
    coalesce(p_reference_number, 'Loan repayment received'),
    p_notes,
    null
  );

  insert into public.loan_given_repayments (
    id, owner_id, loan_id, amount, repayment_date, receiving_account_id,
    payment_method, reference_number, notes, ledger_transaction_id
  )
  values (
    v_repayment_id, v_owner, p_loan_id, p_amount, p_repayment_date,
    p_receiving_account_id, p_payment_method, p_reference_number, p_notes,
    v_ledger_id
  );

  return v_repayment_id;
end;
$$;

create or replace function public.create_loan_taken(
  p_lender_contact_id uuid,
  p_amount numeric,
  p_currency_code char(3),
  p_date_borrowed date,
  p_receiving_account_id uuid,
  p_expected_repayment_date date default null,
  p_reason text default null,
  p_agreement_details text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := (select auth.uid());
  v_account_currency char(3);
  v_loan_id uuid := gen_random_uuid();
  v_ledger_id uuid;
begin
  perform public.require_owner();

  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  select a.currency_code
    into v_account_currency
    from public.accounts a
   where a.id = p_receiving_account_id
     and a.owner_id = v_owner
   for update;

  if not found then
    raise exception 'Account not found' using errcode = '22023';
  end if;
  if v_account_currency is distinct from p_currency_code then
    raise exception 'Currency does not match the selected account'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.contacts c
     where c.id = p_lender_contact_id and c.owner_id = v_owner
  ) then
    raise exception 'Contact not found' using errcode = '22023';
  end if;

  v_ledger_id := public.record_ledger_movement(
    v_owner,
    p_receiving_account_id,
    'borrowing_received',
    1::smallint,
    p_amount,
    p_date_borrowed,
    null,
    null,
    'loan_taken',
    v_loan_id,
    coalesce(p_reason, 'Borrowing received'),
    p_notes,
    null
  );

  insert into public.loans_taken (
    id, owner_id, lender_contact_id, amount, currency_code, date_borrowed,
    reason, expected_repayment_date, receiving_account_id,
    agreement_details, notes, receipt_ledger_id
  )
  values (
    v_loan_id, v_owner, p_lender_contact_id, p_amount, p_currency_code,
    p_date_borrowed, p_reason, p_expected_repayment_date,
    p_receiving_account_id, p_agreement_details, p_notes, v_ledger_id
  );

  return v_loan_id;
end;
$$;

create or replace function public.record_loan_taken_repayment(
  p_loan_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_source_account_id uuid,
  p_payment_method text default null,
  p_reference_number text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := (select auth.uid());
  v_loan_amount numeric(18, 4);
  v_loan_currency char(3);
  v_loan_cancelled_at timestamptz;
  v_account_currency char(3);
  v_balance numeric(18, 4);
  v_total numeric(18, 4);
  v_repayment_id uuid := gen_random_uuid();
  v_ledger_id uuid;
begin
  perform public.require_owner();

  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  select l.amount, l.currency_code, l.cancelled_at
    into v_loan_amount, v_loan_currency, v_loan_cancelled_at
    from public.loans_taken l
   where l.id = p_loan_id and l.owner_id = v_owner
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
   where a.id = p_source_account_id and a.owner_id = v_owner
   for update;

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
   where r.loan_id = p_loan_id
     and r.owner_id = v_owner
     and r.cancelled_at is null;

  if v_total + p_amount > v_loan_amount then
    raise exception 'Repayment total exceeds the loan amount'
      using errcode = '22023';
  end if;

  select a.opening_balance + coalesce((
    select sum(t.direction * t.amount)
      from public.financial_transactions t
     where t.account_id = a.id and t.owner_id = a.owner_id
  ), 0)
    into v_balance
    from public.accounts a
   where a.id = p_source_account_id and a.owner_id = v_owner;

  if v_balance < p_amount then
    raise exception 'Insufficient balance' using errcode = '22023';
  end if;

  v_ledger_id := public.record_ledger_movement(
    v_owner,
    p_source_account_id,
    'borrowing_repayment_paid',
    (-1)::smallint,
    p_amount,
    p_payment_date,
    null,
    null,
    'loan_taken_repayment',
    v_repayment_id,
    coalesce(p_reference_number, 'Borrowing repayment paid'),
    p_notes,
    null
  );

  insert into public.loan_taken_repayments (
    id, owner_id, loan_id, amount, payment_date, source_account_id,
    payment_method, reference_number, notes, ledger_transaction_id
  )
  values (
    v_repayment_id, v_owner, p_loan_id, p_amount, p_payment_date,
    p_source_account_id, p_payment_method, p_reference_number, p_notes,
    v_ledger_id
  );

  return v_repayment_id;
end;
$$;

revoke all on function
  public.create_loan_given(uuid, numeric, char(3), date, uuid, date, text, text, text, text),
  public.record_loan_given_repayment(uuid, numeric, date, uuid, text, text, text),
  public.create_loan_taken(uuid, numeric, char(3), date, uuid, date, text, text, text),
  public.record_loan_taken_repayment(uuid, numeric, date, uuid, text, text, text)
  from public, anon;

grant execute on function
  public.create_loan_given(uuid, numeric, char(3), date, uuid, date, text, text, text, text),
  public.record_loan_given_repayment(uuid, numeric, date, uuid, text, text, text),
  public.create_loan_taken(uuid, numeric, char(3), date, uuid, date, text, text, text),
  public.record_loan_taken_repayment(uuid, numeric, date, uuid, text, text, text)
  to authenticated;
