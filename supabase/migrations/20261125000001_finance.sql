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

-- ---------------------------------------------------------------------------
-- Reporting rates. Historical translations must use a rate snapshotted on or
-- before the business date; no live FX lookups are ever made.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_reporting_rate(
  p_currency_code char(3),
  p_reporting_currency char(3),
  p_business_date date
) returns numeric(18, 8)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_rate numeric(18, 8);
begin
  if p_currency_code = p_reporting_currency then
    return 1;
  end if;

  select er.rate
    into v_rate
    from public.exchange_rates er
   where er.from_currency = p_currency_code
     and er.to_currency = p_reporting_currency
     and er.effective_date <= p_business_date
   order by er.effective_date desc
   limit 1;

  if v_rate is not null then
    return v_rate;
  end if;

  select er.rate
    into v_rate
    from public.exchange_rates er
   where er.from_currency = p_reporting_currency
     and er.to_currency = p_currency_code
     and er.effective_date <= p_business_date
   order by er.effective_date desc
   limit 1;

  if v_rate is not null then
    return round(1 / v_rate, 8);
  end if;

  raise exception 'No snapshotted exchange rate for % to % on %',
    p_currency_code, p_reporting_currency, p_business_date
    using errcode = '22023';
end;
$$;

revoke all on function public.resolve_reporting_rate(character, character, date)
  from public, anon;
grant execute on function public.resolve_reporting_rate(character, character, date)
  to authenticated;

-- The one canonical ledger writer. Lending, borrowing and donations call this
-- exact signature in later migrations; do not change the argument list.
create or replace function public.record_ledger_movement(
  p_owner_id uuid,
  p_account_id uuid,
  p_transaction_type text,
  p_direction smallint,
  p_amount numeric,
  p_business_date date,
  p_category_id uuid,
  p_transfer_id uuid,
  p_reference_type text,
  p_reference_id uuid,
  p_description text,
  p_notes text,
  p_reverses_transaction_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_currency_code char(3);
  v_reporting_currency char(3);
  v_rate numeric(18, 8);
  v_ledger_id uuid;
begin
  if p_owner_id is distinct from (select auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  perform public.require_owner();

  select a.currency_code
    into v_currency_code
    from public.accounts a
   where a.id = p_account_id
     and a.owner_id = p_owner_id;
  if not found then
    raise exception 'Account not found' using errcode = '22023';
  end if;

  select s.reporting_currency
    into v_reporting_currency
    from public.user_settings s
   where s.user_id = p_owner_id;
  if v_reporting_currency is null then
    v_reporting_currency := 'EUR'::char(3);
  end if;

  v_rate := public.resolve_reporting_rate(
    v_currency_code, v_reporting_currency, p_business_date
  );

  insert into public.financial_transactions (
    owner_id,
    account_id,
    transaction_type,
    direction,
    amount,
    currency_code,
    business_date,
    category_id,
    transfer_id,
    reference_type,
    reference_id,
    description,
    notes,
    reverses_transaction_id,
    is_reversal,
    exchange_rate_to_reporting,
    reporting_currency,
    amount_reporting,
    created_by
  ) values (
    p_owner_id,
    p_account_id,
    p_transaction_type,
    p_direction,
    p_amount,
    v_currency_code,
    p_business_date,
    p_category_id,
    p_transfer_id,
    p_reference_type,
    p_reference_id,
    p_description,
    p_notes,
    p_reverses_transaction_id,
    p_reverses_transaction_id is not null,
    v_rate,
    v_reporting_currency,
    round(p_amount * v_rate, 4),
    auth.uid()
  )
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$$;

revoke all on function public.record_ledger_movement(
  uuid, uuid, text, smallint, numeric, date, uuid, uuid, text, uuid, text, text, uuid
) from public, anon;
grant execute on function public.record_ledger_movement(
  uuid, uuid, text, smallint, numeric, date, uuid, uuid, text, uuid, text, text, uuid
) to authenticated;

-- ---------------------------------------------------------------------------
-- Business RPCs. Each locks the affected accounts, checks the available cash
-- balance, and writes business + ledger rows in one transaction.
-- ---------------------------------------------------------------------------

create or replace function public.create_income(
  p_account_id uuid,
  p_amount numeric,
  p_business_date date,
  p_category_id uuid,
  p_description text,
  p_notes text,
  p_reference_number text
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_account public.accounts%rowtype;
  v_notes text;
  v_ledger_id uuid;
begin
  perform public.require_owner();

  -- Locked so concurrent movements cannot interleave with this deposit.
  select a.* into v_account
    from public.accounts a
   where a.id = p_account_id
     and a.owner_id = v_owner_id
   for update;
  if not found then
    raise exception 'Account not found' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.finance_categories c
     where c.id = p_category_id
       and c.owner_id = v_owner_id
       and c.kind = 'income'
  ) then
    raise exception 'Category not found' using errcode = '22023';
  end if;

  if p_reference_number is null or btrim(p_reference_number) = '' then
    v_notes := p_notes;
  elsif p_notes is null or btrim(p_notes) = '' then
    v_notes := 'Reference: ' || btrim(p_reference_number);
  else
    v_notes := p_notes || E'\nReference: ' || btrim(p_reference_number);
  end if;

  v_ledger_id := public.record_ledger_movement(
    v_owner_id, p_account_id, 'income', 1::smallint, p_amount, p_business_date,
    p_category_id, null, 'income', null, p_description, v_notes, null
  );
  return v_ledger_id;
end;
$$;

create or replace function public.create_expense(
  p_account_id uuid,
  p_amount numeric,
  p_business_date date,
  p_category_id uuid,
  p_description text,
  p_notes text,
  p_reference_number text
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_account public.accounts%rowtype;
  v_movements numeric(18, 4);
  v_balance numeric(18, 4);
  v_notes text;
  v_ledger_id uuid;
begin
  perform public.require_owner();

  select a.* into v_account
    from public.accounts a
   where a.id = p_account_id
     and a.owner_id = v_owner_id
   for update;
  if not found then
    raise exception 'Account not found' using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.finance_categories c
     where c.id = p_category_id
       and c.owner_id = v_owner_id
       and c.kind = 'expense'
  ) then
    raise exception 'Category not found' using errcode = '22023';
  end if;

  select coalesce(sum(t.direction::numeric * t.amount), 0)
    into v_movements
    from public.financial_transactions t
   where t.owner_id = v_owner_id
     and t.account_id = p_account_id;
  v_balance := round(v_account.opening_balance + v_movements, 4);
  if p_amount > v_balance then
    raise exception 'Insufficient balance' using errcode = '22023';
  end if;

  if p_reference_number is null or btrim(p_reference_number) = '' then
    v_notes := p_notes;
  elsif p_notes is null or btrim(p_notes) = '' then
    v_notes := 'Reference: ' || btrim(p_reference_number);
  else
    v_notes := p_notes || E'\nReference: ' || btrim(p_reference_number);
  end if;

  v_ledger_id := public.record_ledger_movement(
    v_owner_id, p_account_id, 'expense', (-1)::smallint, p_amount, p_business_date,
    p_category_id, null, 'expense', null, p_description, v_notes, null
  );
  return v_ledger_id;
end;
$$;

create or replace function public.create_transfer(
  p_source_account_id uuid,
  p_destination_account_id uuid,
  p_source_amount numeric,
  p_destination_amount numeric,
  p_exchange_rate numeric,
  p_fee_amount numeric,
  p_transfer_date date,
  p_reference_number text,
  p_notes text
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_source public.accounts%rowtype;
  v_destination public.accounts%rowtype;
  v_movements numeric(18, 4);
  v_balance numeric(18, 4);
  v_rate numeric(18, 8);
  v_fee numeric(18, 4) := coalesce(p_fee_amount, 0);
  v_transfer_id uuid;
  v_out_ledger_id uuid;
  v_in_ledger_id uuid;
  v_fee_ledger_id uuid;
begin
  perform public.require_owner();

  if p_source_account_id = p_destination_account_id then
    raise exception 'Source and destination accounts must differ'
      using errcode = '22023';
  end if;
  if p_source_amount is null or p_source_amount <= 0
     or p_destination_amount is null or p_destination_amount <= 0 then
    raise exception 'Transfer amounts must be greater than zero'
      using errcode = '22023';
  end if;
  if v_fee < 0 then
    raise exception 'The transfer fee cannot be negative'
      using errcode = '22023';
  end if;

  select a.* into v_source
    from public.accounts a
   where a.id = p_source_account_id
     and a.owner_id = v_owner_id
   for update;
  if not found then
    raise exception 'Source account not found' using errcode = '22023';
  end if;

  select a.* into v_destination
    from public.accounts a
   where a.id = p_destination_account_id
     and a.owner_id = v_owner_id
   for update;
  if not found then
    raise exception 'Destination account not found' using errcode = '22023';
  end if;

  if v_source.currency_code = v_destination.currency_code then
    if round(p_destination_amount, 4) <> round(p_source_amount - v_fee, 4) then
      raise exception
        'For the same currency, the destination amount must equal the source amount minus the fee'
        using errcode = '22023';
    end if;
    v_rate := 1;
  else
    if p_exchange_rate is null or p_exchange_rate <= 0 then
      raise exception 'The exchange rate must be greater than zero'
        using errcode = '22023';
    end if;
    v_rate := p_exchange_rate;
  end if;

  select coalesce(sum(t.direction::numeric * t.amount), 0)
    into v_movements
    from public.financial_transactions t
   where t.owner_id = v_owner_id
     and t.account_id = p_source_account_id;
  v_balance := round(v_source.opening_balance + v_movements, 4);
  if round(p_source_amount + v_fee, 4) > v_balance then
    raise exception 'Insufficient balance' using errcode = '22023';
  end if;

  insert into public.account_transfers (
    owner_id,
    source_account_id,
    destination_account_id,
    source_amount,
    source_currency,
    destination_amount,
    destination_currency,
    exchange_rate,
    fee_amount,
    transfer_date,
    reference_number,
    notes
  ) values (
    v_owner_id,
    p_source_account_id,
    p_destination_account_id,
    p_source_amount,
    v_source.currency_code,
    p_destination_amount,
    v_destination.currency_code,
    v_rate,
    v_fee,
    p_transfer_date,
    p_reference_number,
    p_notes
  )
  returning id into v_transfer_id;

  v_out_ledger_id := public.record_ledger_movement(
    v_owner_id, p_source_account_id, 'transfer_out', (-1)::smallint, p_source_amount,
    p_transfer_date, null, v_transfer_id, 'transfer', v_transfer_id,
    'Transfer to ' || v_destination.name, p_notes, null
  );
  v_in_ledger_id := public.record_ledger_movement(
    v_owner_id, p_destination_account_id, 'transfer_in', 1::smallint, p_destination_amount,
    p_transfer_date, null, v_transfer_id, 'transfer', v_transfer_id,
    'Transfer from ' || v_source.name, p_notes, null
  );
  if v_fee > 0 then
    v_fee_ledger_id := public.record_ledger_movement(
      v_owner_id, p_source_account_id, 'expense', (-1)::smallint, v_fee,
      p_transfer_date, null, v_transfer_id, 'transfer_fee', v_transfer_id,
      'Transfer fee', p_notes, null
    );
  end if;

  update public.account_transfers
     set out_ledger_id = v_out_ledger_id,
         in_ledger_id = v_in_ledger_id,
         fee_ledger_id = v_fee_ledger_id
   where id = v_transfer_id
     and owner_id = v_owner_id;

  return v_transfer_id;
end;
$$;

revoke all on function public.create_income(uuid, numeric, date, uuid, text, text, text)
  from public, anon;
revoke all on function public.create_expense(uuid, numeric, date, uuid, text, text, text)
  from public, anon;
revoke all on function public.create_transfer(uuid, uuid, numeric, numeric, numeric, numeric, date, text, text)
  from public, anon;

grant execute on function public.create_income(uuid, numeric, date, uuid, text, text, text)
  to authenticated;
grant execute on function public.create_expense(uuid, numeric, date, uuid, text, text, text)
  to authenticated;
grant execute on function public.create_transfer(uuid, uuid, numeric, numeric, numeric, numeric, date, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();
create trigger finance_categories_set_updated_at
  before update on public.finance_categories
  for each row execute function public.set_updated_at();
create trigger account_transfers_set_updated_at
  before update on public.account_transfers
  for each row execute function public.set_updated_at();

create trigger accounts_audit
  after insert or update or delete on public.accounts
  for each row execute function public.audit_mutation();
create trigger finance_categories_audit
  after insert or update or delete on public.finance_categories
  for each row execute function public.audit_mutation();
create trigger financial_transactions_audit
  after insert on public.financial_transactions
  for each row execute function public.audit_mutation();
create trigger account_transfers_audit
  after insert or update or delete on public.account_transfers
  for each row execute function public.audit_mutation();

-- ---------------------------------------------------------------------------
-- RLS. The ledger is append-only for clients: SELECT and INSERT policies only,
-- no UPDATE/DELETE policies or grants.
-- ---------------------------------------------------------------------------

alter table public.accounts enable row level security;
alter table public.finance_categories enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.account_transfers enable row level security;

create policy accounts_owner_all on public.accounts
  for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy finance_categories_owner_all on public.finance_categories
  for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy financial_transactions_owner_select on public.financial_transactions
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner());

create policy financial_transactions_owner_insert on public.financial_transactions
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_owner());

create policy account_transfers_owner_all on public.account_transfers
  for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_owner())
  with check (owner_id = (select auth.uid()) and public.is_owner());

revoke all on public.accounts, public.finance_categories,
  public.financial_transactions, public.account_transfers from public, anon;

grant select, insert, update, delete on public.accounts,
  public.finance_categories, public.account_transfers to authenticated;
grant select, insert on public.financial_transactions to authenticated;
revoke update, delete on public.financial_transactions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Computed views. security_invoker keeps each reader's RLS in force.
-- ---------------------------------------------------------------------------

create or replace view public.account_balances_v
with (security_invoker = true) as
select
  a.owner_id,
  a.id as account_id,
  a.name,
  a.currency_code,
  a.opening_balance,
  coalesce(sum(t.direction::numeric * t.amount), 0)::numeric(18, 4) as ledger_balance,
  (a.opening_balance + coalesce(sum(t.direction::numeric * t.amount), 0))::numeric(18, 4) as balance
from public.accounts a
left join public.financial_transactions t
  on t.account_id = a.id
 and t.owner_id = a.owner_id
group by a.owner_id, a.id, a.name, a.currency_code, a.opening_balance;

-- Transfers and loan principal movements do not belong in income/expense.
-- Donation corrections do: a reversal is a refund and an adjustment is an
-- additional expense, so every included row is classified by its direction.
create or replace view public.monthly_cashflow_v
with (security_invoker = true) as
select
  t.owner_id,
  to_char(t.business_date, 'YYYY-MM') as month,
  a.country_code,
  t.currency_code,
  t.reporting_currency,
  coalesce(sum(case when t.direction > 0 then t.amount else 0 end), 0)::numeric(18, 4) as income_amount,
  coalesce(sum(case when t.direction < 0 then t.amount else 0 end), 0)::numeric(18, 4) as expense_amount,
  coalesce(sum(t.direction::numeric * t.amount), 0)::numeric(18, 4) as net_amount,
  coalesce(sum(case when t.direction > 0 then t.amount_reporting else 0 end), 0)::numeric(18, 4) as income_reporting,
  coalesce(sum(case when t.direction < 0 then t.amount_reporting else 0 end), 0)::numeric(18, 4) as expense_reporting,
  coalesce(sum(t.direction::numeric * t.amount_reporting), 0)::numeric(18, 4) as net_reporting
from public.financial_transactions t
join public.accounts a
  on a.id = t.account_id
 and a.owner_id = t.owner_id
where t.transaction_type in ('income', 'expense', 'donation', 'correction', 'reversal')
group by
  t.owner_id,
  to_char(t.business_date, 'YYYY-MM'),
  a.country_code,
  t.currency_code,
  t.reporting_currency;

revoke all on public.account_balances_v, public.monthly_cashflow_v from public, anon;
grant select on public.account_balances_v, public.monthly_cashflow_v to authenticated;

-- ---------------------------------------------------------------------------
-- Seed categories for owners provisioned before this migration and for every
-- owner profile created afterwards.
-- ---------------------------------------------------------------------------

create or replace function public.seed_finance_categories()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.finance_categories (owner_id, name, kind)
  select new.id, c.name, c.kind
  from (values
    ('Salary', 'income'),
    ('Freelance', 'income'),
    ('Gift', 'income'),
    ('Other income', 'income'),
    ('Food', 'expense'),
    ('Housing', 'expense'),
    ('Transport', 'expense'),
    ('Health', 'expense'),
    ('Education', 'expense'),
    ('Other expense', 'expense')
  ) as c(name, kind)
  on conflict (owner_id, kind, name) do nothing;
  return new;
end;
$$;

revoke all on function public.seed_finance_categories()
  from public, anon, authenticated;

create trigger profiles_seed_finance_categories
  after insert on public.profiles
  for each row execute function public.seed_finance_categories();

insert into public.finance_categories (owner_id, name, kind)
select p.id, c.name, c.kind
from public.profiles p
cross join (values
  ('Salary', 'income'),
  ('Freelance', 'income'),
  ('Gift', 'income'),
  ('Other income', 'income'),
  ('Food', 'expense'),
  ('Housing', 'expense'),
  ('Transport', 'expense'),
  ('Health', 'expense'),
  ('Education', 'expense'),
  ('Other expense', 'expense')
) as c(name, kind)
where p.role = 'owner'
on conflict (owner_id, kind, name) do nothing;
