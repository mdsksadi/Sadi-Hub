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

-- ---------------------------------------------------------------------------
-- Recipient report. Corrections net against the original gift; each row stays
-- separated by currency and country so EUR and BDT are never summed.
-- ---------------------------------------------------------------------------

create view public.contact_donation_summary_v
with (security_invoker = true) as
with correction_net as (
  select
    c.donation_id,
    sum(case when c.correction_type = 'reversal' then -c.amount else c.amount end) as delta
  from public.donation_corrections c
  group by c.donation_id
), gift_rows as (
  select
    d.owner_id,
    case
      when d.contact_id is null
        then 'name:' || lower(regexp_replace(btrim(d.recipient_name), '[[:space:]]+', ' ', 'g'))
      else 'contact:' || d.contact_id::text
    end as recipient_key,
    d.contact_id,
    coalesce(c.full_name, d.recipient_name) as recipient_name,
    coalesce(c.contact_type::text, d.recipient_type::text) as recipient_type,
    d.currency_code,
    coalesce(d.country_code, c.country_code) as country_code,
    d.amount + coalesce(cn.delta, 0) as amount,
    d.donation_date
  from public.donations d
  left join public.contacts c
    on c.id = d.contact_id and c.owner_id = d.owner_id
  left join correction_net cn on cn.donation_id = d.id
)
select
  owner_id,
  recipient_key,
  contact_id,
  max(recipient_name) as recipient_name,
  max(recipient_type) as recipient_type,
  currency_code,
  country_code,
  round(sum(amount), 4) as total_amount,
  count(*)::bigint as donation_count,
  min(donation_date) as first_date,
  max(donation_date) as last_date
from gift_rows
group by owner_id, recipient_key, contact_id, currency_code, country_code;

revoke all on public.contact_donation_summary_v from public, anon;
grant select on public.contact_donation_summary_v to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic RPCs. Both are SECURITY INVOKER so RLS and require_owner() apply.
-- Ledger rows are written first with a pre-generated business id, so no
-- immutable business row ever needs an UPDATE after its ledger id is known.
-- ---------------------------------------------------------------------------

create or replace function public.create_donation(
  p_contact_id uuid default null,
  p_recipient_name text default null,
  p_recipient_type text default null,
  p_amount text default null,
  p_currency_code text default null,
  p_donation_date text default null,
  p_source_account_id uuid default null,
  p_purpose text default null,
  p_category_id uuid default null,
  p_country_code text default null,
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
  v_owner_id uuid := (select auth.uid());
  v_account public.accounts%rowtype;
  v_contact public.contacts%rowtype;
  v_amount numeric;
  v_balance numeric;
  v_currency text;
  v_requested_currency text;
  v_recipient_name text;
  v_recipient_type text;
  v_country text;
  v_donation_id uuid := gen_random_uuid();
  v_ledger_id uuid;
begin
  perform public.require_owner();

  if p_source_account_id is null then
    raise exception 'Source account is required' using errcode = '22004';
  end if;

  begin
    v_amount := nullif(btrim(coalesce(p_amount, '')), '')::numeric;
  exception when invalid_text_representation then
    raise exception 'Enter a valid amount' using errcode = '22023';
  end;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  if coalesce(btrim(coalesce(p_donation_date, '')), '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Use a valid date' using errcode = '22023';
  end if;

  -- Lock the account before checking its balance and writing the ledger row.
  select * into v_account
  from public.accounts a
  where a.id = p_source_account_id and a.owner_id = v_owner_id
  for update;
  if not found then
    raise exception 'Account not found' using errcode = '22023';
  end if;
  if not v_account.is_active then
    raise exception 'Account is not active' using errcode = '22023';
  end if;

  -- The account is the currency source; an explicit value must agree with it.
  v_currency := btrim(v_account.currency_code::text);
  v_requested_currency := nullif(upper(btrim(coalesce(p_currency_code, ''))), '');
  if v_requested_currency is not null and v_requested_currency <> v_currency then
    raise exception 'Currency % does not match the source account currency %',
      v_requested_currency, v_currency using errcode = '22023';
  end if;

  if p_contact_id is not null then
    select * into v_contact
    from public.contacts c
    where c.id = p_contact_id and c.owner_id = v_owner_id;
    if not found then
      raise exception 'Contact not found' using errcode = '22023';
    end if;
    v_recipient_name := coalesce(
      nullif(btrim(coalesce(p_recipient_name, '')), ''),
      btrim(v_contact.full_name)
    );
    v_recipient_type := v_contact.contact_type::text;
    v_country := nullif(
      coalesce(btrim(coalesce(p_country_code, '')), btrim(v_contact.country_code)),
      ''
    );
  else
    v_recipient_name := btrim(coalesce(p_recipient_name, ''));
    v_recipient_type := btrim(coalesce(p_recipient_type, ''));
    if v_recipient_type not in ('individual', 'organization') then
      raise exception 'Recipient type is required' using errcode = '22023';
    end if;
    v_country := nullif(btrim(coalesce(p_country_code, '')), '');
  end if;

  if coalesce(v_recipient_name, '') = '' then
    raise exception 'Recipient name is required' using errcode = '22023';
  end if;
  if length(v_recipient_name) > 150 then
    raise exception 'Recipient name is too long' using errcode = '22023';
  end if;
  if v_country is not null and length(v_country) <> 2 then
    raise exception 'Country code must be two letters' using errcode = '22023';
  end if;
  if p_category_id is not null and not exists (
    select 1 from public.donation_categories dc
    where dc.id = p_category_id and dc.owner_id = v_owner_id
  ) then
    raise exception 'Category not found' using errcode = '22023';
  end if;

  select v_account.opening_balance + coalesce((
    select sum(t.direction::numeric * t.amount)
    from public.financial_transactions t
    where t.owner_id = v_owner_id and t.account_id = v_account.id
  ), 0) into v_balance;
  if v_balance < v_amount then
    raise exception 'Insufficient balance' using errcode = '23514';
  end if;

  -- Donation categories are a separate taxonomy from finance categories, so
  -- the ledger keeps its category null and the business row stores the slug id.
  v_ledger_id := public.record_ledger_movement(
    v_owner_id,
    v_account.id,
    'donation',
    -1,
    v_amount,
    p_donation_date::date,
    null,
    null,
    'donation',
    v_donation_id,
    'Donation to ' || v_recipient_name,
    p_notes,
    null
  );

  insert into public.donations (
    id, owner_id, contact_id, recipient_name, recipient_type, amount,
    currency_code, donation_date, purpose, category_id, country_code,
    source_account_id, payment_method, reference_number, notes,
    ledger_transaction_id, created_by
  ) values (
    v_donation_id, v_owner_id, p_contact_id, v_recipient_name, v_recipient_type,
    v_amount, v_currency, p_donation_date::date,
    nullif(btrim(coalesce(p_purpose, '')), ''), p_category_id, v_country,
    v_account.id,
    nullif(btrim(coalesce(p_payment_method, '')), ''),
    nullif(btrim(coalesce(p_reference_number, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    v_ledger_id, v_owner_id
  );

  return v_donation_id;
end;
$$;

create or replace function public.correct_donation(
  p_donation_id uuid default null,
  p_correction_type text default null,
  p_amount text default null,
  p_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := (select auth.uid());
  v_donation public.donations%rowtype;
  v_account public.accounts%rowtype;
  v_amount numeric;
  v_balance numeric;
  v_refundable numeric;
  v_correction_type text;
  v_ledger_type text;
  v_direction smallint;
  v_reverses_transaction_id uuid;
  v_correction_id uuid := gen_random_uuid();
  v_ledger_id uuid;
begin
  perform public.require_owner();

  if p_donation_id is null then
    raise exception 'Donation is required' using errcode = '22004';
  end if;
  if btrim(coalesce(p_correction_type, '')) not in ('reversal', 'adjustment') then
    raise exception 'Use reversal or adjustment' using errcode = '22023';
  end if;
  if coalesce(btrim(coalesce(p_reason, '')), '') = '' then
    raise exception 'Reason is required' using errcode = '22023';
  end if;

  begin
    v_amount := nullif(btrim(coalesce(p_amount, '')), '')::numeric;
  exception when invalid_text_representation then
    raise exception 'Enter a valid amount' using errcode = '22023';
  end;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Amount must be greater than zero' using errcode = '22023';
  end if;

  -- The original donation is never locked for update: authenticated has no
  -- UPDATE privilege on this immutable table. The source account lock below
  -- serializes concurrent corrections for the same cash balance.
  select * into v_donation
  from public.donations d
  where d.id = p_donation_id and d.owner_id = v_owner_id;
  if not found then
    raise exception 'Donation not found' using errcode = '22023';
  end if;

  select * into v_account
  from public.accounts a
  where a.id = v_donation.source_account_id and a.owner_id = v_owner_id
  for update;
  if not found then
    raise exception 'Account not found' using errcode = '22023';
  end if;

  v_correction_type := btrim(p_correction_type);
  if v_correction_type = 'reversal' then
    v_ledger_type := 'reversal';
    v_direction := 1;
    v_reverses_transaction_id := v_donation.ledger_transaction_id;

    -- Adjustments increase the refundable gift; earlier reversals reduce it.
    -- The account lock above serializes this check with other corrections.
    select v_donation.amount + coalesce(sum(case
      when c.correction_type = 'adjustment' then c.amount
      else -c.amount
    end), 0) into v_refundable
    from public.donation_corrections c
    where c.owner_id = v_owner_id and c.donation_id = v_donation.id;
    if v_amount > v_refundable then
      raise exception 'Reversal exceeds the remaining donation amount'
        using errcode = '23514';
    end if;
  else
    v_ledger_type := 'correction';
    v_direction := -1;
    v_reverses_transaction_id := null;

    select v_account.opening_balance + coalesce((
      select sum(t.direction::numeric * t.amount)
      from public.financial_transactions t
      where t.owner_id = v_owner_id and t.account_id = v_account.id
    ), 0) into v_balance;
    if v_balance < v_amount then
      raise exception 'Insufficient balance' using errcode = '23514';
    end if;
  end if;

  v_ledger_id := public.record_ledger_movement(
    v_owner_id,
    v_account.id,
    v_ledger_type,
    v_direction,
    v_amount,
    v_donation.donation_date,
    null,
    null,
    'donation_correction',
    v_correction_id,
    'Donation ' || v_ledger_type || ' for ' || v_donation.recipient_name,
    p_reason,
    v_reverses_transaction_id
  );

  insert into public.donation_corrections (
    id, owner_id, donation_id, correction_type, amount, reason,
    ledger_transaction_id
  ) values (
    v_correction_id, v_owner_id, v_donation.id, v_correction_type, v_amount,
    btrim(p_reason), v_ledger_id
  );

  return v_correction_id;
end;
$$;

revoke all on function public.create_donation(
  uuid, text, text, text, text, text, uuid, text, uuid, text, text, text, text
) from public, anon;
grant execute on function public.create_donation(
  uuid, text, text, text, text, text, uuid, text, uuid, text, text, text, text
) to authenticated;

revoke all on function public.correct_donation(uuid, text, text, text)
  from public, anon;
grant execute on function public.correct_donation(uuid, text, text, text)
  to authenticated;
